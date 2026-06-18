from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

from core.config import settings

# ---------------------------------------------------------------------------
# ABI encoding helpers (no web3 dependency — uses eth_abi + eth_utils which
# are already pulled in by eth-account)
# ---------------------------------------------------------------------------
try:
    from eth_abi import encode as abi_encode          # type: ignore
    from eth_utils import keccak, to_checksum_address  # type: ignore
except ImportError as e:
    raise ImportError("eth-account (which bundles eth_abi and eth_utils) is required.") from e

# keccak256("mint(address,string)") first 4 bytes
_MINT_SELECTOR: bytes = keccak(text="mint(address,string)")[:4]

# keccak256("Transfer(address,address,uint256)") as hex without 0x
_TRANSFER_SIG: str = keccak(text="Transfer(address,address,uint256)").hex()

# Zero address padded to 32 bytes (topic format)
_ZERO_TOPIC: str = "0x" + "0" * 64


@dataclass
class NftMintResult:
    token_id: int
    tx_hash: str
    block_number: int
    contract_address: str
    explorer_url: str


class NftMintError(Exception):
    pass


class NftMintService:
    """Mints a Soulbound ERC-721 badge on Ethereum Sepolia."""

    def __init__(self) -> None:
        self.rpc_url = settings.eth_sepolia_rpc_url.strip()
        self.private_key = settings.eth_sepolia_private_key.strip()
        self.contract_address = settings.nft_contract_address.strip()
        self.explorer_base_url = (
            settings.eth_sepolia_explorer_base_url.strip()
            or "https://sepolia.etherscan.io/tx/"
        )

    def _require_config(self) -> None:
        if not self.rpc_url:
            raise NftMintError("ETH_SEPOLIA_RPC_URL is missing.")
        if not self.private_key:
            raise NftMintError("ETH_SEPOLIA_PRIVATE_KEY is missing.")
        if not self.contract_address:
            raise NftMintError("NFT_CONTRACT_ADDRESS is missing.")


    async def _rpc(self, method: str, params: list[Any]) -> Any:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                self.rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            )
        resp.raise_for_status()
        payload = resp.json()
        if payload.get("error"):
            raise NftMintError(f"RPC error: {payload['error']}")
        return payload.get("result")

    async def _wait_for_receipt(self, tx_hash: str) -> dict[str, Any]:
        for _ in range(20):
            receipt = await self._rpc("eth_getTransactionReceipt", [tx_hash])
            if receipt:
                return receipt
            await asyncio.sleep(2)
        raise NftMintError(f"Timed out waiting for receipt: {tx_hash}")


    @staticmethod
    def _encode_mint_call(to_address: str, token_uri: str) -> str:
        """Returns hex-encoded calldata for mint(address,string)."""
        encoded = abi_encode(["address", "string"], [to_address, token_uri])
        return "0x" + _MINT_SELECTOR.hex() + encoded.hex()


    def _parse_token_id(self, receipt: dict[str, Any]) -> int:
        contract = self.contract_address.lower()
        for log in receipt.get("logs", []):
            topics = log.get("topics", [])
            if (
                log.get("address", "").lower() == contract
                and len(topics) == 4
                and topics[0].lstrip("0x") == _TRANSFER_SIG
                and topics[1].lower() == _ZERO_TOPIC.lower()
            ):
                return int(topics[3], 16)
        raise NftMintError("Transfer event not found in receipt — could not extract token_id.")

    async def mint(self, to_address: str, token_uri: str) -> NftMintResult:
        """
        Mint a badge NFT to `to_address` with `token_uri`.
        Returns NftMintResult containing token_id and tx details.
        """
        self._require_config()

        try:
            from eth_account import Account  # type: ignore
        except ImportError as exc:
            raise NftMintError("eth-account is required.") from exc

        checksum_wallet = Account.from_key(self.private_key).address
        checksum_to = to_checksum_address(to_address)
        checksum_contract = to_checksum_address(self.contract_address)

        nonce_hex = await self._rpc("eth_getTransactionCount", [checksum_wallet, "pending"])
        gas_price_hex = await self._rpc("eth_gasPrice", [])
        chain_id_hex = await self._rpc("eth_chainId", [])

        calldata = self._encode_mint_call(checksum_to, token_uri)

        # Estimate gas with 20% buffer
        try:
            gas_estimate_hex = await self._rpc(
                "eth_estimateGas",
                [{"from": checksum_wallet, "to": checksum_contract, "data": calldata}],
            )
            gas_limit = int(int(gas_estimate_hex, 16) * 1.2)
        except NftMintError:
            gas_limit = 200_000  # safe fallback for ERC-721 mint

        tx = {
            "to": checksum_contract,
            "value": 0,
            "nonce": int(nonce_hex, 16),
            "gas": gas_limit,
            "gasPrice": int(gas_price_hex, 16),
            "chainId": int(chain_id_hex, 16),
            "data": calldata,
        }

        signed = Account.sign_transaction(tx, self.private_key)
        tx_hash = await self._rpc(
            "eth_sendRawTransaction", [f"0x{signed.raw_transaction.hex()}"]
        )
        receipt = await self._wait_for_receipt(tx_hash)

        if receipt.get("status") == "0x0":
            raise NftMintError(f"Mint transaction reverted: {tx_hash}")

        token_id = self._parse_token_id(receipt)
        block_number = int(receipt.get("blockNumber", "0x0"), 16)
        explorer_url = self.explorer_base_url.rstrip("/") + "/" + tx_hash

        return NftMintResult(
            token_id=token_id,
            tx_hash=tx_hash,
            block_number=block_number,
            contract_address=self.contract_address,
            explorer_url=explorer_url,
        )
