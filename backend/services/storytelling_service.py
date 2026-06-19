from __future__ import annotations

import logging
from typing import Any

from core.config import settings
from trading_agent.config import DEFAULT_TRADING_AGENT_CONFIG

logger = logging.getLogger("hackathon-pland")

_ACHIEVEMENT_NICKNAMES: dict[str, str] = {
    "diversified_5_assets":  "Seed Sower",
    "diversified_10_assets": "Portfolio Gardener",
    "diversified_20_assets": "Allocation Master",
    "rich_10k":              "10K Club",
    "rich_50k":              "50K Whale",
    "rich_100k":             "100K Whale",
    "drawdown_guard_10":     "Capital Keeper",
    "drawdown_guard_5":      "Capital Guardian",
    "sharpe_1_0":            "Sharpe Hunter",
    "sharpe_2_0":            "Risk-Adjusted Legend",
}

_ACHIEVEMENT_CRITERIA: dict[str, str] = {
    "diversified_5_assets":  "Held at least 5 distinct assets",
    "diversified_10_assets": "Held at least 10 distinct assets",
    "diversified_20_assets": "Held at least 20 distinct assets",
    "rich_10k":              "Portfolio total value reached $10,000",
    "rich_50k":              "Portfolio total value reached $50,000",
    "rich_100k":             "Portfolio total value reached $100,000",
    "drawdown_guard_10":     "Maximum drawdown kept below 10%",
    "drawdown_guard_5":      "Maximum drawdown kept below 5%",
    "sharpe_1_0":            "Sharpe ratio (30d) exceeded 1.0",
    "sharpe_2_0":            "Sharpe ratio (30d) exceeded 2.0",
}


def _get_llm() -> Any:
    provider = DEFAULT_TRADING_AGENT_CONFIG.llm_provider.lower()
    if provider == "openrouter":
        from langchain_openai import ChatOpenAI  # type: ignore
        api_key = settings.openrouter_api_key
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set.")
        model = DEFAULT_TRADING_AGENT_CONFIG.model_name
        if model == "gemini-2.5-flash":
            model = "google/gemini-2.5-flash"
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.7,
            max_retries=2,
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore
        api_key = settings.gemini_api_key
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set.")
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=api_key,
            temperature=0.7,
            max_retries=2,
        )


def _build_nft_summary(nfts: list[dict]) -> str:
    if not nfts:
        return "No verified on-chain achievements found."

    lines: list[str] = []
    for nft in nfts:
        key = nft.get("achievementKey") or "manual"
        nickname = _ACHIEVEMENT_NICKNAMES.get(key, nft.get("title", "Certified Snapshot"))
        criteria = _ACHIEVEMENT_CRITERIA.get(key, "Manual portfolio checkpoint")
        date = (nft.get("snapshotAt") or "")[:10]
        token_id = nft.get("nftTokenId")
        hash_ok = nft.get("hashVerified")
        etherscan = nft.get("etherscanUrl", "")

        verified_note = ""
        if hash_ok is True:
            verified_note = " [hash verified on-chain ✓]"
        elif hash_ok is False:
            verified_note = " [hash MISMATCH ✗]"
        else:
            verified_note = " [hash not checked]"

        lines.append(
            f"- {nickname} ({date}){verified_note}: {criteria}. "
            f"Token #{token_id}. Etherscan: {etherscan}"
        )

    return "\n".join(lines)


_SHARE_SYSTEM_PROMPT = """\
You are a creative financial storyteller for PLAND, a crypto portfolio management platform.
Your task is to write a short, engaging, first-person narrative (3–5 sentences) of the user's \
investment journey based exclusively on their on-chain verified achievements.

Guidelines:
- Write in first person ("you" perspective), conversational and inspiring tone
- Highlight key milestones chronologically (earliest first)
- Mention badge names naturally (e.g. "earning the Seed Sower badge")
- Do not invent numbers or dates not explicitly provided
- Keep it under 120 words
- End with a forward-looking, motivational sentence
- Do NOT mention PLAND, Ethereum, or blockchain technology explicitly — keep it about the journey
"""

_AUDIT_SYSTEM_PROMPT = """\
You are a financial compliance analyst for PLAND.
Your task is to produce a structured due-diligence audit report of a user's portfolio milestones.
All claims must reference on-chain verified data provided by the user.

Output a JSON object with the following fields:
- "summary": one paragraph summary of the investment track record
- "milestones": array of objects, each with:
    - "badge": badge nickname
    - "date": ISO date
    - "criterion": what was achieved
    - "onChainProof": etherscan URL or "N/A"
    - "hashVerified": true/false/null
- "overallAssessment": one sentence risk/credibility assessment
- "caveats": list of any data gaps or unverified items

Be concise and factual. Do not speculate beyond the provided data.
"""


async def generate_share_narrative(nfts: list[dict]) -> str:
    """6.3: Generate a social-share narrative from on-chain verified NFT data."""
    summary = _build_nft_summary(nfts)
    user_input = (
        f"Here are my on-chain verified portfolio achievements:\n\n{summary}\n\n"
        "Write my investment story narrative."
    )

    llm = _get_llm()
    messages = [("system", _SHARE_SYSTEM_PROMPT), ("human", user_input)]
    response = await llm.ainvoke(messages)
    content = response.content if hasattr(response, "content") else str(response)
    return content.strip()


async def generate_audit_report(nfts: list[dict]) -> dict:
    """6.4: Generate a structured audit report from on-chain verified NFT data."""
    from pydantic import BaseModel, Field  # local import to keep this module lean

    class MilestoneEntry(BaseModel):
        badge: str
        date: str
        criterion: str
        onChainProof: str
        hashVerified: bool | None = None

    class AuditReport(BaseModel):
        summary: str
        milestones: list[MilestoneEntry] = Field(default_factory=list)
        overallAssessment: str
        caveats: list[str] = Field(default_factory=list)

    summary = _build_nft_summary(nfts)
    user_input = (
        f"Here are my on-chain verified portfolio achievements:\n\n{summary}\n\n"
        "Produce the structured audit report."
    )

    llm = _get_llm()
    structured_llm = llm.with_structured_output(AuditReport)
    messages = [("system", _AUDIT_SYSTEM_PROMPT), ("human", user_input)]
    result: AuditReport = await structured_llm.ainvoke(messages)
    return result.model_dump()
