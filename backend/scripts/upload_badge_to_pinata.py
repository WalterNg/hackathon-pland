"""
One-time script: upload badge images to Pinata IPFS for the NFT metadata endpoint.

Usage:
    python backend/scripts/upload_badge_to_pinata.py --image path/to/manual_cert.png --key manual_cert

Requires PINATA_API_KEY and PINATA_API_SECRET in .env.local
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "backend"))

PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"


def upload(image_path: Path, name: str, api_key: str, api_secret: str) -> str:
    with image_path.open("rb") as f:
        resp = httpx.post(
            PINATA_UPLOAD_URL,
            headers={
                "pinata_api_key": api_key,
                "pinata_secret_api_key": api_secret,
            },
            files={"file": (image_path.name, f, "image/png")},
            data={"pinataMetadata": f'{{"name": "{name}"}}'},
            timeout=60.0,
        )
    resp.raise_for_status()
    cid = resp.json()["IpfsHash"]
    return cid


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to badge PNG image")
    parser.add_argument("--key", required=True, help="Achievement key (e.g. manual_cert, rich_10k)")
    args = parser.parse_args()

    api_key = os.environ.get("PINATA_API_KEY", "")
    api_secret = os.environ.get("PINATA_API_SECRET", "")
    if not api_key or not api_secret:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env.local")
        load_dotenv(ROOT / ".env")
        api_key = os.environ.get("PINATA_API_KEY", "")
        api_secret = os.environ.get("PINATA_API_SECRET", "")

    if not api_key or not api_secret:
        print("ERROR: PINATA_API_KEY and PINATA_API_SECRET must be set in .env.local")
        sys.exit(1)

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"ERROR: file not found: {image_path}")
        sys.exit(1)

    cid = upload(image_path, args.key, api_key, api_secret)
    print(f"Uploaded '{args.key}' → ipfs://{cid}")
    print(f"Add this CID to _ACHIEVEMENT_IMAGE in nft_certificate.py:")
    print(f'  "{args.key}": "ipfs://{cid}",')


if __name__ == "__main__":
    main()
