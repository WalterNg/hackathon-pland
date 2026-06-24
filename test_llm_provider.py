"""
Quick smoke-test: check if OpenRouter / Gemini structured output is working.
Run from repo root:
    pip install langchain-openai pydantic python-dotenv
    python test_llm_provider.py
"""

import asyncio
import os
import time
from typing import List, Literal

import yaml
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

load_dotenv(".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

with open("backend/trading_agent/config.yaml") as f:
    _cfg = yaml.safe_load(f)

PROVIDER = _cfg["llm"]["provider"]
MODEL = _cfg["llm"]["model_name"]
# OpenRouter expects "google/gemini-..." but raw config may store "gemini-..."
if PROVIDER == "openrouter" and not MODEL.startswith("google/"):
    MODEL = f"google/{MODEL}"

# --- Schemas matching the real agents ---

class DebateTurn(BaseModel):
    speaker: str
    stance: Literal["Bullish", "Bearish", "Aggressive", "Neutral", "Conservative", "Manager", "Judge", "Trader"]
    message: str

class TechnicalAnalysisReport(BaseModel):
    portfolio_trend: Literal["Bullish", "Bearish", "Neutral"]
    signal_strength: int = Field(..., ge=1, le=10)
    strongest_positions: List[str] = Field(default_factory=list)
    weakest_positions: List[str] = Field(default_factory=list)
    summary: str
    evidence: List[str] = Field(default_factory=list)


def make_client():
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not found in backend/.env")
    return ChatOpenAI(
        model=MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.2,
    )


async def test_schema(label: str, schema, system: str, user: str):
    print(f"\n[{label}] Testing structured output...")
    llm = make_client().with_structured_output(schema)
    t0 = time.time()
    try:
        result = await llm.ainvoke([("system", system), ("human", user)])
        elapsed = time.time() - t0
        print(f"  OK ({elapsed:.1f}s)")
        print(f"  Result: {result}")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  FAILED ({elapsed:.1f}s): {e}")


async def main():
    print(f"Provider : {PROVIDER}")
    print(f"Model    : {MODEL}")
    print(f"API key  : {'SET' if OPENROUTER_API_KEY else 'MISSING'}\n")

    # Test 1: simple DebateTurn (small schema)
    await test_schema(
        "DebateTurn",
        DebateTurn,
        system="You are the aggressive risk analyst. Argue for allowing measured upside.",
        user="Portfolio: 60% NVDA, 40% cash. Trader proposes accumulating more NVDA.",
    )

    # Test 2: TechnicalAnalysisReport (larger schema, more fields)
    await test_schema(
        "TechnicalAnalysisReport",
        TechnicalAnalysisReport,
        system="You are a technical analyst. Analyse the portfolio and return a structured report.",
        user="Portfolio: NVDA 60%, AAPL 40%. Both in uptrends. RSI neutral.",
    )

    # Test 3: rapid-fire 3 calls to surface rate-limiting
    print("\n[RateLimit] Firing 3 sequential calls to check for throttling...")
    for i in range(3):
        await test_schema(
            f"RateLimit #{i+1}",
            DebateTurn,
            system="You are a risk analyst.",
            user=f"Call number {i+1}. Short answer only.",
        )
        await asyncio.sleep(0.5)


if __name__ == "__main__":
    asyncio.run(main())
