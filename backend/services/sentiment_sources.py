from typing import Optional

import httpx


FNG_API_URL = "https://api.alternative.me/fng/"


async def fetch_fear_greed_index(timeout: float = 5.0) -> Optional[float]:
    """
    Fetch the current Crypto Fear & Greed Index (0–100).

    Returns:
        float in [0, 100] if successful, otherwise None.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(FNG_API_URL, timeout=timeout)
            resp.raise_for_status()
        data = resp.json()
        value_str = data["data"][0]["value"]
        return float(value_str)
    except Exception:
        return None

