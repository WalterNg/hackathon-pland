from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import os
import time
from typing import Iterable
from urllib.parse import urlencode

import httpx

from core.config import settings
from schemas.input import BinanceConnectionPreviewRequest
from schemas.output import (
    BinanceConnectedPosition,
    BinanceConnectionAccountInfo,
    BinanceConnectionAsset,
    BinanceConnectionPreviewData,
    BinanceConnectionTotals,
    BinanceConnectionWarning,
)

logger = logging.getLogger("hackathon-pland")


class BinanceConnectorError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class BinanceConnector:
    DEMO_BASE_URL = "https://demo-api.binance.com"
    DEFAULT_TIMEOUT = 10.0
    DEFAULT_RECV_WINDOW_MS = 5000
    STABLECOINS = {
        "USDT",
        "USDC",
        "BUSD",
        "FDUSD",
        "TUSD",
        "DAI",
        "USDP",
        "PYUSD",
    }
    COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
    
    # Cache for symbol to CoinGecko ID mapping
    _cg_id_cache: dict[str, str] = {}
    _cg_cache_ttl: int = 3600  # 1 hour
    _cg_cache_last_refresh: float = 0

    async def _fetch_coingecko_id_map(self) -> dict[str, str]:
        """
        Fetches the mapping of Binance base assets to CoinGecko IDs from Supabase.
        Uses a 1-hour cache to avoid redundant database calls.
        """
        now = time.time()
        if self._cg_id_cache and (now - self._cg_cache_last_refresh < self._cg_cache_ttl):
            return self._cg_id_cache

        logger.info("Fetching CoinGecko ID mapping from Supabase...")
        
        # We use the Supabase REST API (Postgrest) to fetch mappings
        # where coingecko_id is not null
        url = f"{settings.supabase_url}/rest/v1/market_symbols?select=base_asset,coingecko_id&coingecko_id=not.is.null"
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                new_cache = {
                    item["base_asset"]: item["coingecko_id"]
                    for item in data
                    if item.get("base_asset") and item.get("coingecko_id")
                }
                
                # Update class-level cache
                BinanceConnector._cg_id_cache = new_cache
                BinanceConnector._cg_cache_last_refresh = now
                logger.info("Successfully refreshed CoinGecko ID cache with %d mappings", len(new_cache))
                return new_cache

        except Exception as e:
            logger.error("Failed to fetch CoinGecko ID mapping from Supabase: %s", str(e))
            # Fallback to current cache if it exists, even if stale
            return self._cg_id_cache

    def __init__(self, timeout: float | None = None):
        self.timeout = timeout or self.DEFAULT_TIMEOUT

    def _normalize_asset(self, asset: str) -> str:
        return asset.strip().upper()

    def _asset_to_price_symbol(self, asset: str) -> str | None:
        normalized = self._normalize_asset(asset)
        if not normalized:
            return None
        if normalized in self.STABLECOINS:
            return None
        if normalized.endswith("USDT"):
            return normalized
        return f"{normalized}USDT"

    def _sign_query(self, query_string: str, api_secret: str) -> str:
        signature = hmac.new(
            api_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return signature

    def _credentials_from_env(self) -> tuple[str, str]:
        api_key_name, api_secret_name = "BINANCE_DEMO_API_KEY", "BINANCE_DEMO_SECRET_KEY"
        api_key = os.getenv(api_key_name, "").strip()
        api_secret = os.getenv(api_secret_name, "").strip()

        if api_key and api_secret:
            return api_key, api_secret

        raise BinanceConnectorError(
            f"Demo credentials are missing. Set {api_key_name} and {api_secret_name} in the server .env.",
            status_code=400,
        )

    async def _request_json(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
    ) -> dict | list:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.request(method, url, headers=headers)
            if response.status_code >= 400:
                raise BinanceConnectorError(
                    f"Binance request failed ({response.status_code}): {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def fetch_account_balances(
        self,
        api_key: str,
        api_secret: str,
        recv_window_ms: int = DEFAULT_RECV_WINDOW_MS,
    ) -> dict:
        timestamp = int(time.time() * 1000)
        query_string = urlencode(
            {
                "recvWindow": recv_window_ms,
                "timestamp": timestamp,
            }
        )
        signature = self._sign_query(query_string, api_secret)
        url = f"{self.DEMO_BASE_URL}/api/v3/account?{query_string}&signature={signature}"

        try:
            payload = await self._request_json(
                "GET",
                url,
                headers={"X-MBX-APIKEY": api_key},
            )
        except httpx.TimeoutException as exc:
            raise BinanceConnectorError("Binance request timed out.") from exc
        except httpx.RequestError as exc:
            raise BinanceConnectorError(f"Binance request failed: {str(exc)}") from exc

        if not isinstance(payload, dict):
            raise BinanceConnectorError("Unexpected Binance account payload.")

        return payload

    async def fetch_price_map(self, symbols: Iterable[str]) -> dict[str, float]:
        """
        Fetches current market prices for a list of symbols using CoinGecko's public batch API.
        This approach is more robust in cloud environments (like GCP) where Binance market
        data endpoints may be blocked.
        """
        price_map: dict[str, float] = {}
        unique_assets: set[str] = set()
        
        # 1. Normalize and deduplicate assets
        for raw_asset in symbols:
            asset = self._normalize_asset(raw_asset)
            if not asset or asset in self.STABLECOINS:
                continue
            unique_assets.add(asset)

        if not unique_assets:
            return price_map

        # 2. Map Binance symbols to CoinGecko IDs using the dynamic mapping
        cg_id_map = await self._fetch_coingecko_id_map()
        
        asset_to_id = {
            asset: cg_id_map[asset] 
            for asset in unique_assets 
            if asset in cg_id_map
        }
        
        coingecko_ids = list(asset_to_id.values())

        if not coingecko_ids:
            # If no mapping found, return empty map (will result in $0 price warnings)
            return price_map

        # 3. Perform batch request to CoinGecko
        ids_param = ",".join(coingecko_ids)
        url = f"{self.COINGECKO_BASE_URL}/simple/price?ids={ids_param}&vs_currencies=usd"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    logger.warning(f"CoinGecko API returned status {response.status_code}")
                    return price_map
                
                data = response.json()
                
                # 4. Map back to Binance symbols
                # Note: CoinGecko returns {"bitcoin": {"usd": 123}, ...}
                for asset, cg_id in asset_to_id.items():
                    price_info = data.get(cg_id)
                    if price_info and "usd" in price_info:
                        # Map to the price_symbol used by the rest of the class (usually ASSETUSDT)
                        price_symbol = self._asset_to_price_symbol(asset)
                        if price_symbol:
                            price_map[price_symbol] = float(price_info["usd"])

        except (httpx.RequestError, httpx.TimeoutException, ValueError) as exc:
            logger.warning(f"Failed to fetch prices from CoinGecko: {str(exc)}")
            
        return price_map

    async def build_connection_preview(self, payload: BinanceConnectionPreviewRequest) -> BinanceConnectionPreviewData:
        """
        Orchestrates the full Binance connection preview process.
        Returns a structured payload containing account metadata, asset balances, 
        and aggregate USD totals.
        """
        # 1. Resolve credentials (API key and Secret)
        api_key = payload.api_key
        api_secret = payload.api_secret

        if not api_key or not api_secret:
            api_key, api_secret = self._credentials_from_env()

        if not api_key or not api_secret:
            raise BinanceConnectorError("Binance API key and secret are required.", status_code=400)

        # 2. Fetch raw account data from Binance
        account_payload = await self.fetch_account_balances(
            api_key=api_key,
            api_secret=api_secret,
            recv_window_ms=payload.recv_window_ms,
        )

        balances = account_payload.get("balances", [])
        if not isinstance(balances, list):
            raise BinanceConnectorError("Invalid balances payload returned by Binance.")

        # 3. Pre-fetch a price map for all assets present in the account
        # We fetch all prices in parallel before processing the loop for better performance.
        price_map = await self.fetch_price_map(
            (balance.get("asset", "") for balance in balances if isinstance(balance, dict)),
        )

        # 4. Process and normalize individual balances
        normalized_balances = []
        warnings: list[BinanceConnectionWarning] = []
        total_estimated_usd = 0.0
        non_zero_asset_count = 0

        for balance in balances:
            if not isinstance(balance, dict):
                continue

            # Identify and normalize the asset name (e.g., 'btc ' -> 'BTC')
            asset = self._normalize_asset(str(balance.get("asset", "") or ""))
            if not asset:
                continue

            # Extract and validate quantities
            try:
                free = float(balance.get("free", 0) or 0)
                locked = float(balance.get("locked", 0) or 0)
            except (TypeError, ValueError):
                free = 0.0
                locked = 0.0

            quantity = max(0.0, free + locked)
            
            # Filter zero-balance assets if requested
            if quantity <= 0 and not payload.include_zero_balances:
                continue

            # Resolve USD price
            is_stablecoin = asset in self.STABLECOINS
            price_symbol = self._asset_to_price_symbol(asset)
            
            # Use fixed 1.0 for stablecoins, otherwise lookup in the pre-fetched map
            price_usd = 1.0 if is_stablecoin else price_map.get(price_symbol or "", 0.0)
            estimated_usd = quantity * price_usd

            # Track global statistics and warnings
            if quantity > 0:
                non_zero_asset_count += 1
            
            if quantity > 0 and not is_stablecoin and price_usd <= 0:
                warnings.append(
                    BinanceConnectionWarning(
                        code="price_unavailable",
                        message=f"Unable to resolve USD price for {asset}.",
                        severity="warning",
                    )
                )

            # Assemble the normalized asset object
            normalized_balances.append(
                BinanceConnectionAsset(
                    asset=asset,
                    free=round(free, 12),
                    locked=round(locked, 12),
                    quantity=round(quantity, 12),
                    price_usd=round(price_usd, 12),
                    estimated_usd=round(estimated_usd, 12),
                    is_stablecoin=is_stablecoin,
                )
            )
            total_estimated_usd += estimated_usd

        # 5. Handle cases with no returned balances
        if not normalized_balances:
            warnings.append(
                BinanceConnectionWarning(
                    code="no_balances",
                    message="No non-zero balances were returned by Binance.",
                    severity="info",
                )
            )

        # 6. Build the final response objects
        account_info = BinanceConnectionAccountInfo(
            account_type=account_payload.get("accountType"),
            can_trade=bool(account_payload.get("canTrade", False)),
            can_withdraw=bool(account_payload.get("canWithdraw", False)),
            can_deposit=bool(account_payload.get("canDeposit", False)),
            update_time=account_payload.get("updateTime"),
        )

        return BinanceConnectionPreviewData(
            account=account_info,
            assets=normalized_balances,
            totals=BinanceConnectionTotals(
                asset_count=len(normalized_balances),
                non_zero_asset_count=non_zero_asset_count,
                total_estimated_usd=round(total_estimated_usd, 12),
            ),
            warnings=warnings,
        )

    async def build_connected_positions(self, payload: BinanceConnectionPreviewRequest) -> list[BinanceConnectedPosition]:
        preview = await self.build_connection_preview(payload)
        positions: list[BinanceConnectedPosition] = []

        for asset in preview.assets:
            if asset.quantity <= 0:
                continue

            symbol = asset.asset if asset.is_stablecoin else self._asset_to_price_symbol(asset.asset)
            if not symbol:
                continue

            positions.append(
                BinanceConnectedPosition(
                    symbol=symbol,
                    quantity=asset.quantity,
                    avg_buy_price_usd=asset.price_usd if asset.price_usd > 0 else 1.0,
                )
            )

        return positions
