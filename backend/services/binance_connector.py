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

from schemas.input import BinanceConnectionPreviewRequest
from schemas.output import (
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
    TESTNET_BASE_URL = "https://testnet.binance.vision"
    DEFAULT_TIMEOUT = 8.0
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

    def __init__(self, timeout: float | None = None):
        self.timeout = timeout or self.DEFAULT_TIMEOUT

    def _base_url(self, mode: str) -> str:
        if mode == "demo":
            return self.DEMO_BASE_URL
        if mode == "testnet":
            return self.TESTNET_BASE_URL
        raise BinanceConnectorError("Unsupported Binance preview mode.", status_code=400)

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

    def _credentials_from_env(self, mode: str) -> tuple[str, str]:
        mode_to_env_keys = {
            "demo": ("BINANCE_DEMO_API_KEY", "BINANCE_DEMO_SECRET_KEY"),
            "testnet": ("BINANCE_TESTNET_API_KEY", "BINANCE_TESTNET_SECRET_KEY"),
        }

        env_keys = mode_to_env_keys.get(mode)
        if not env_keys:
            raise BinanceConnectorError("Unsupported Binance preview mode.", status_code=400)

        api_key_name, api_secret_name = env_keys
        api_key = os.getenv(api_key_name, "").strip()
        api_secret = os.getenv(api_secret_name, "").strip()

        if api_key and api_secret:
            return api_key, api_secret

        # Backward compatibility while environments migrate to mode-specific vars.
        legacy_api_key = os.getenv("BINANCE_API_KEY", "").strip()
        legacy_api_secret = os.getenv("BINANCE_SECRET_KEY", "").strip()
        if legacy_api_key and legacy_api_secret:
            return legacy_api_key, legacy_api_secret

        raise BinanceConnectorError(
            f"{mode.title()} credentials are missing. Set {api_key_name} and {api_secret_name} in the server .env.",
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
        mode: str,
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
        base_url = self._base_url(mode)
        url = f"{base_url}/api/v3/account?{query_string}&signature={signature}"

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

    async def fetch_price_map(self, symbols: Iterable[str], mode: str) -> dict[str, float]:
        base_url = self._base_url(mode)
        price_map: dict[str, float] = {}
        unique_symbols = []
        seen = set()

        for raw_symbol in symbols:
            symbol = self._normalize_asset(raw_symbol)
            price_symbol = self._asset_to_price_symbol(symbol)
            if not price_symbol or price_symbol in seen:
                continue
            seen.add(price_symbol)
            unique_symbols.append(price_symbol)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async def fetch_symbol_price(symbol: str) -> tuple[str, float]:
                url = f"{base_url}/api/v3/ticker/price?symbol={symbol}"

                try:
                    response = await client.get(url)
                    if response.status_code >= 400:
                        return symbol, 0.0
                    payload = response.json()
                except (httpx.RequestError, httpx.TimeoutException, ValueError):
                    return symbol, 0.0

                if isinstance(payload, dict):
                    try:
                        return symbol, float(payload.get("price", 0) or 0)
                    except (TypeError, ValueError):
                        return symbol, 0.0

                return symbol, 0.0

            results = await asyncio.gather(*(fetch_symbol_price(symbol) for symbol in unique_symbols))

        for symbol, price in results:
            price_map[symbol] = price
        return price_map

    async def build_connection_preview(self, payload: BinanceConnectionPreviewRequest) -> BinanceConnectionPreviewData:
        api_key = payload.api_key
        api_secret = payload.api_secret

        if not api_key or not api_secret:
            api_key, api_secret = self._credentials_from_env(payload.mode)

        if not api_key or not api_secret:
            raise BinanceConnectorError("Binance API key and secret are required.", status_code=400)

        account_payload = await self.fetch_account_balances(
            api_key=api_key,
            api_secret=api_secret,
            mode=payload.mode,
            recv_window_ms=payload.recv_window_ms,
        )

        balances = account_payload.get("balances", [])
        if not isinstance(balances, list):
            raise BinanceConnectorError("Invalid balances payload returned by Binance.")

        normalized_balances = []
        warnings: list[BinanceConnectionWarning] = []

        price_map = await self.fetch_price_map(
            (balance.get("asset", "") for balance in balances if isinstance(balance, dict)),
            mode=payload.mode,
        )

        total_estimated_usd = 0.0
        non_zero_asset_count = 0

        for balance in balances:
            if not isinstance(balance, dict):
                continue

            asset = self._normalize_asset(str(balance.get("asset", "") or ""))
            if not asset:
                continue

            try:
                free = float(balance.get("free", 0) or 0)
                locked = float(balance.get("locked", 0) or 0)
            except (TypeError, ValueError):
                free = 0.0
                locked = 0.0

            quantity = max(0.0, free + locked)
            if quantity <= 0 and not payload.include_zero_balances:
                continue

            is_stablecoin = asset in self.STABLECOINS
            price_symbol = self._asset_to_price_symbol(asset)
            price_usd = 1.0 if is_stablecoin else price_map.get(price_symbol or "", 0.0)
            estimated_usd = quantity * price_usd

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

        if not normalized_balances:
            warnings.append(
                BinanceConnectionWarning(
                    code="no_balances",
                    message="No non-zero balances were returned by Binance.",
                    severity="info",
                )
            )

        account_info = BinanceConnectionAccountInfo(
            account_type=account_payload.get("accountType"),
            can_trade=bool(account_payload.get("canTrade", False)),
            can_withdraw=bool(account_payload.get("canWithdraw", False)),
            can_deposit=bool(account_payload.get("canDeposit", False)),
            update_time=account_payload.get("updateTime"),
        )

        return BinanceConnectionPreviewData(
            mode=payload.mode,
            account=account_info,
            assets=normalized_balances,
            totals=BinanceConnectionTotals(
                asset_count=len(normalized_balances),
                non_zero_asset_count=non_zero_asset_count,
                total_estimated_usd=round(total_estimated_usd, 12),
            ),
            warnings=warnings,
        )
