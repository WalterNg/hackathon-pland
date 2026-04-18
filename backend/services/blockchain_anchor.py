from __future__ import annotations

import asyncio
from typing import Any

import httpx

from core.config import settings
from schemas.portfolio_snapshot_certificate import PortfolioSnapshotAnchorResult


class BlockchainAnchorError(Exception):
    pass


class EthereumSepoliaHashAnchorService:
    def __init__(self) -> None:
        self.rpc_url = settings.eth_sepolia_rpc_url.strip()
        self.private_key = settings.eth_sepolia_private_key.strip()
        self.anchor_wallet_address = settings.eth_sepolia_anchor_wallet_address.strip()
        self.explorer_base_url = settings.eth_sepolia_explorer_base_url.strip() or "https://sepolia.etherscan.io/tx/"

    def _require_config(self) -> None:
        if not self.rpc_url:
            raise BlockchainAnchorError("ETH_SEPOLIA_RPC_URL is missing.")
        if not self.private_key:
            raise BlockchainAnchorError("ETH_SEPOLIA_PRIVATE_KEY is missing.")

    async def _rpc_call(self, method: str, params: list[Any]) -> Any:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params,
                },
            )
        response.raise_for_status()
        payload = response.json()
        if payload.get("error"):
            raise BlockchainAnchorError(str(payload["error"]))
        return payload.get("result")

    def build_explorer_url(self, tx_hash: str) -> str:
        base = self.explorer_base_url.rstrip("/")
        return f"{base}/{tx_hash}" if not base.endswith("/tx") else f"{base}/{tx_hash}"

    async def _wait_for_receipt(self, tx_hash: str) -> dict[str, Any]:
        for _ in range(10):
            receipt = await self._rpc_call("eth_getTransactionReceipt", [tx_hash])
            if receipt:
                return receipt
            await asyncio.sleep(1)
        raise BlockchainAnchorError("Timed out while waiting for Sepolia transaction receipt.")

    async def anchor_snapshot_hash(self, snapshot_hash: str) -> PortfolioSnapshotAnchorResult:
        self._require_config()

        try:
            from eth_account import Account  # type: ignore
        except ImportError as exc:
            raise BlockchainAnchorError("eth-account is required to sign Sepolia transactions.") from exc

        checksum_address = Account.from_key(self.private_key).address
        wallet_address = self.anchor_wallet_address or checksum_address
        nonce_hex = await self._rpc_call("eth_getTransactionCount", [checksum_address, "pending"])
        gas_price_hex = await self._rpc_call("eth_gasPrice", [])
        chain_id_hex = await self._rpc_call("eth_chainId", [])

        transaction = {
            "to": checksum_address,
            "value": 0,
            "nonce": int(nonce_hex, 16),
            "gas": 50_000,
            "gasPrice": int(gas_price_hex, 16),
            "chainId": int(chain_id_hex, 16),
            "data": f"0x{snapshot_hash}",
        }

        signed_tx = Account.sign_transaction(transaction, self.private_key)
        tx_hash = await self._rpc_call("eth_sendRawTransaction", [f"0x{signed_tx.raw_transaction.hex()}"])
        receipt = await self._wait_for_receipt(tx_hash)

        block_number = int(receipt.get("blockNumber", "0x0"), 16)
        block_hash = receipt.get("blockHash") or ""

        return PortfolioSnapshotAnchorResult(
            txHash=tx_hash,
            blockNumber=block_number,
            blockHash=block_hash,
            walletAddress=wallet_address,
            explorerUrl=self.build_explorer_url(tx_hash),
        )
