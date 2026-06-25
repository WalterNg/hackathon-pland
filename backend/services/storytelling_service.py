from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from core.config import settings
from services.portfolio_achievement_store import list_portfolio_achievement_unlocks
from services.portfolio_snapshot_certificate_store import (
    get_latest_portfolio_snapshot,
    list_portfolio_snapshot_certificates,
    resolve_portfolio,
)
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
        return "No on-chain checkpoints found."

    lines: list[str] = []
    for nft in nfts:
        key = nft.get("achievementKey")
        label = _ACHIEVEMENT_NICKNAMES.get(key or "", None) or nft.get("title") or "Certified Snapshot"
        criteria = _ACHIEVEMENT_CRITERIA.get(key or "", "Portfolio checkpoint certified on-chain")
        date = (nft.get("snapshotAt") or "")[:10]
        token_id = nft.get("nftTokenId")
        hash_ok = nft.get("hashVerified")
        etherscan = nft.get("etherscanUrl", "")

        verified_note = (
            " [hash verified ✓]" if hash_ok is True
            else " [hash MISMATCH ✗]" if hash_ok is False
            else ""
        )

        lines.append(
            f"- {label} ({date}){verified_note}: {criteria}. "
            f"Token #{token_id}. Etherscan: {etherscan}"
        )

    return "\n".join(lines)


def _format_number(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return f"{value}"
    if isinstance(value, float):
        if value != value:
            return ""
        return f"{value:.2f}".rstrip("0").rstrip(".")
    return str(value)


def _format_percent(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if number != number:
        return ""
    return f"{number:.2f}%"


def _format_iso_date(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value[:10] if len(value) >= 10 else value
    return parsed.date().isoformat()


def _safe_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _safe_json(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_safe_json(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _is_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def _escape_markdown_cell(value: Any) -> str:
    text = _format_number(value) if isinstance(value, (int, float)) else str(value or "")
    return text.replace("|", "\\|").replace("\n", " ").strip()


def _humanize_key(key: str) -> str:
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", key.replace("_", " ")).split()
    return " ".join(word.upper() if word.lower() in {"usd", "var", "rsi", "obv", "ytd"} else word.capitalize() for word in words)


def _render_section(title: str, body: str) -> str:
    if not body.strip():
        return ""
    return f"## {title}\n\n{body.strip()}"


def _bullet_list(rows: list[list[Any]]) -> str:
    lines: list[str] = []
    for row in rows:
        if len(row) < 2:
            continue
        label, value = row[0], row[1]
        if not _is_present(value):
            continue
        lines.append(f"- **{_escape_markdown_cell(label)}:** {_escape_markdown_cell(value)}")
    return "\n".join(lines)


def _format_currency(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return _format_number(value)
    if number != number:
        return ""
    return f"${number:,.2f}"


def _format_ratio_percent(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if number != number:
        return ""
    return f"{number * 100:.2f}%"


def _format_percentage(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if number != number:
        return ""
    return f"{number:.2f}%"


def _format_metric_value(key: str, value: Any) -> str:
    lower_key = key.lower()
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        if "usd" in lower_key or lower_key.endswith("value"):
            return _format_currency(value)
        if lower_key.endswith("percent") or "percent" in lower_key:
            return _format_percentage(value)
        if lower_key in {"cashratio", "cash_ratio"}:
            return _format_ratio_percent(value)
        if lower_key.endswith("ratio") and "sharpe" not in lower_key and "sortino" not in lower_key and "calmar" not in lower_key:
            return _format_ratio_percent(value)
        return _format_number(value)
    return str(value)


def _non_empty_dict_rows(data: dict[str, Any], *, exclude: set[str] | None = None) -> list[list[Any]]:
    rows: list[list[Any]] = []
    excluded = exclude or set()
    for key in sorted(data.keys()):
        if key in excluded:
            continue
        value = data[key]
        if not _is_present(value) or isinstance(value, (dict, list)):
            continue
        rows.append([_humanize_key(key), _format_metric_value(key, value)])
    return rows


def _render_key_value_section(title: str, rows: list[list[Any]]) -> str:
    return _render_section(title, _bullet_list(rows))


def _violation_rows(violations: list[dict[str, Any]]) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for violation in violations:
        if not isinstance(violation, dict):
            continue
        rows.append([
            violation.get("event_type"),
            violation.get("severity"),
            violation.get("title"),
            violation.get("message"),
            violation.get("observed_value"),
            violation.get("threshold_value"),
            violation.get("symbol"),
        ])
    return rows


def _checkpoint_rows(checkpoints: list[dict[str, Any]]) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for checkpoint in checkpoints:
        if not isinstance(checkpoint, dict):
            continue
        rows.append([
            checkpoint.get("badge"),
            checkpoint.get("date"),
            checkpoint.get("criterion"),
            "Yes" if checkpoint.get("hashVerified") is True else "No" if checkpoint.get("hashVerified") is False else "",
            checkpoint.get("onChainProof"),
        ])
    return rows


def _holdings_rows(top_holdings: list[dict[str, Any]]) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for holding in top_holdings:
        if not isinstance(holding, dict):
            continue
        rows.append([
            holding.get("symbol"),
            _format_ratio_percent(holding.get("weight")),
            holding.get("quantity"),
            _format_currency(holding.get("currentPrice")),
            _format_currency(holding.get("valueUsd")),
        ])
    return rows


def _recommendation_for_violation(violation: dict[str, Any]) -> str:
    event_type = str(violation.get("event_type") or "").lower()
    if "drawdown" in event_type:
        return "Reduce exposure or rebalance until drawdown returns below the configured threshold."
    if "position" in event_type:
        symbol = str(violation.get("symbol") or "").replace("USDT", "")
        return f"Trim {symbol or 'the oversized position'} to bring allocation back within the configured limit."
    if "daily_loss" in event_type:
        return "Pause new risk and review recent losses against the daily-loss control."
    return "Review the active violation and align the portfolio with the configured risk control."


def _fmt_condition(metric: str, operator: str, threshold: float) -> str:
    op = "≥" if operator == "gte" else "≤"
    if metric == "total_value_usd":
        return f"Value {op} {_format_currency(threshold)}"
    if metric == "distinct_assets":
        return f"Assets {op} {int(threshold)}"
    if metric == "max_drawdown_percent":
        return f"Drawdown {op} {threshold:.0f}%"
    if metric == "sharpe_ratio_30d":
        return f"Sharpe {op} {threshold:.1f}"
    return f"{metric} {op} {threshold}"


def _fmt_observed(metric: str, value: Any) -> str:
    if value is None:
        return "—"
    try:
        fval = float(value)
    except (TypeError, ValueError):
        return str(value)
    if metric == "total_value_usd":
        return _format_currency(fval)
    if metric == "distinct_assets":
        return f"{int(fval)} assets"
    if metric == "max_drawdown_percent":
        return f"−{abs(fval):.1f}%"
    if metric == "sharpe_ratio_30d":
        return f"{fval:.2f}"
    return f"{fval:.2f}"


def _get_metric_value(metrics: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        val = metrics.get(key)
        if val is not None:
            return val
    return None


def _shorten_hash(h: str | None) -> str:
    if not h or len(h) < 14:
        return h or "—"
    return f"{h[:8]}…{h[-6:]}"


def _render_audit_markdown(state_packet: dict[str, Any]) -> str:
    portfolio_name = (state_packet.get("portfolio") or {}).get("name") or "Portfolio"
    report_date = (state_packet.get("portfolio") or {}).get("dateOfReport") or ""
    all_certs: list[dict[str, Any]] = state_packet.get("all_certs") or []
    all_unlocks: list[dict[str, Any]] = state_packet.get("all_unlocks") or []
    nfts_by_cert_id: dict[str, dict] = state_packet.get("nfts_by_cert_id") or {}

    certs_asc = sorted(all_certs, key=lambda c: str(c.get("snapshotAt") or ""))
    unlocks_asc = sorted(all_unlocks, key=lambda u: str(u.get("snapshotAt") or ""))

    period_from = str(certs_asc[0].get("snapshotAt") or "")[:10] if certs_asc else "—"
    period_to = str(certs_asc[-1].get("snapshotAt") or "")[:10] if certs_asc else "—"
    minted_count = sum(1 for c in all_certs if c.get("nftMintStatus") == "minted")

    all_violations: list[dict[str, Any]] = []
    for cert in certs_asc:
        payload = cert.get("snapshotPayload") or {}
        for v in (payload.get("riskViolations") or []):
            if isinstance(v, dict):
                all_violations.append({**v, "_certTitle": cert.get("title"), "_date": str(cert.get("snapshotAt") or "")[:10]})

    lines: list[str] = []
    manual_certs = [c for c in certs_asc if c.get("certifyMode") != "auto_achievement"]
    manual_count = len(manual_certs)

    lines += [
        f"# Audit Report — {portfolio_name}",
        f"**Generated:** {report_date} · **Network:** Ethereum Sepolia · **Period:** {period_from} → {period_to}",
        "",
        "---",
        "",
        "## Tổng quan",
        "",
        "| Snapshots | Thành tích | NFTs Minted | Manual Checkpoints |",
        "|-----------|-----------|-------------|-------------------|",
        f"| {len(all_certs)} | {len(all_unlocks)} / 6 | {minted_count} | {manual_count} |",
        "",
        "---",
        "",
        "## Achievement Claims",
        "",
    ]

    if unlocks_asc:
        lines += [
            "| Badge | Ngày | Điều kiện | Observed | NFT | Hash | Verified |",
            "|-------|------|-----------|----------|-----|------|---------|",
        ]
        for u in unlocks_asc:
            badge = u.get("badgeTitle") or u.get("achievementKey") or "—"
            date = str(u.get("snapshotAt") or "")[:10] or "—"
            condition = _fmt_condition(u.get("metric") or "", u.get("operator") or "gte", float(u.get("threshold") or 0))
            observed = _fmt_observed(u.get("metric") or "", u.get("observedValue"))
            cert_id = u.get("certificateId")
            cert = next((c for c in all_certs if c.get("id") == cert_id), None)
            nft = nfts_by_cert_id.get(cert_id or "") if cert_id else None
            token_id = f"#{cert.get('nftTokenId')}" if cert and cert.get("nftTokenId") else "—"
            tx_hash = _shorten_hash(cert.get("nftTxHash") if cert else None)
            hash_verified = nft.get("hashVerified") if nft else None
            verified = "✅" if hash_verified is True else ("❌" if hash_verified is False else "—")
            lines.append(f"| {badge} | {date} | {condition} | {observed} | {token_id} | {tx_hash} | {verified} |")
    else:
        lines.append("*Chưa có achievement nào được unlock.*")

    lines += ["", "---", "", "## Manual Checkpoints", ""]

    if manual_certs:
        lines += [
            "| Ngày | Tiêu đề | Ghi chú | NFT | Hash |",
            "|------|---------|---------|-----|------|",
        ]
        for cert in manual_certs:
            date = str(cert.get("snapshotAt") or "")[:10] or "—"
            title = _escape_markdown_cell(cert.get("title") or "—")
            note = _escape_markdown_cell(cert.get("note") or "—")
            token_id = f"#{cert.get('nftTokenId')}" if cert.get("nftTokenId") else "—"
            tx_hash = _shorten_hash(cert.get("nftTxHash"))
            lines.append(f"| {date} | {title} | {note} | {token_id} | {tx_hash} |")
    else:
        lines.append("*Chưa có manual checkpoint nào.*")

    lines += ["", "---", "", "## Snapshot History", ""]

    if certs_asc:
        lines += [
            "| Ngày | Tiêu đề | Value (USD) | Assets | Sharpe (30d) | Max Drawdown | NFT | Certified by |",
            "|------|---------|------------|--------|-------------|-------------|-----|-------------|",
        ]
        for cert in certs_asc:
            date = str(cert.get("snapshotAt") or "")[:10] or "—"
            title = _escape_markdown_cell(cert.get("title") or "—")
            payload = cert.get("snapshotPayload") or {}
            summary = payload.get("summary") or {}
            metrics = payload.get("metrics") or {}
            assets = payload.get("assets") or []
            value = _format_currency(summary.get("totalValueUsd")) or "—"
            asset_count = str(len(assets)) if assets else "—"
            sharpe_raw = _get_metric_value(metrics, "sharpe_ratio_30d", "sharpeRatio30d")
            sharpe = f"{float(sharpe_raw):.2f}" if sharpe_raw is not None else "—"
            dd_raw = _get_metric_value(metrics, "max_drawdown_percent", "maxDrawdown", "maxDrawdownPercent")
            drawdown = f"−{abs(float(dd_raw)):.1f}%" if dd_raw is not None else "—"
            token_id = f"#{cert.get('nftTokenId')}" if cert.get("nftTokenId") else "—"
            certify_mode = "Achievement" if cert.get("certifyMode") == "auto_achievement" else "Manual"
            lines.append(f"| {date} | {title} | {value} | {asset_count} | {sharpe} | {drawdown} | {token_id} | {certify_mode} |")
    else:
        lines.append("*Chưa có snapshot nào được certify.*")

    return "\n".join(lines)


def _chart_summary(chart: list[dict[str, Any]]) -> dict[str, str]:
    if len(chart) < 2:
        return {
            "start": None,
            "end": None,
            "periodReturn": None,
            "annualizedReturn": None,
        }

    first = chart[0]
    last = chart[-1]
    try:
        start_value = float(first.get("totalValueUsd", 0) or 0)
        end_value = float(last.get("totalValueUsd", 0) or 0)
    except (TypeError, ValueError):
        return {
            "start": None,
            "end": None,
            "periodReturn": None,
            "annualizedReturn": None,
        }

    start_time_raw = first.get("time")
    end_time_raw = last.get("time")
    if not start_time_raw or not end_time_raw or start_value <= 0:
        return {
            "start": _format_number(start_value),
            "end": _format_number(end_value),
            "periodReturn": None,
            "annualizedReturn": None,
        }

    try:
        start_time = datetime.fromisoformat(str(start_time_raw).replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(str(end_time_raw).replace("Z", "+00:00"))
    except ValueError:
        return {
            "start": _format_number(start_value),
            "end": _format_number(end_value),
            "periodReturn": None,
            "annualizedReturn": None,
        }

    elapsed_days = max((end_time - start_time).total_seconds() / 86400.0, 0.0)
    period_return = ((end_value / start_value) - 1.0) * 100.0 if start_value > 0 else None
    annualized_return = None
    if elapsed_days >= 1.0 and start_value > 0:
        years = elapsed_days / 365.25
        if years > 0:
            annualized_return = ((end_value / start_value) ** (1 / years) - 1.0) * 100.0

    return {
        "start": _format_currency(start_value),
        "end": _format_currency(end_value),
        "periodReturn": _format_percent(period_return),
        "annualizedReturn": _format_percent(annualized_return),
    }


async def _build_audit_packet(
    *,
    user_id: str,
    portfolio_id: str | None,
    nfts: list[dict],
) -> dict[str, Any]:
    """Build the audit state packet from all certificates, achievement unlocks, and verified NFTs."""
    portfolio_name: str | None = None
    report_date = datetime.now(timezone.utc).date().isoformat()

    all_certs_raw: list[dict[str, Any]] = []
    all_unlocks_raw: list[dict[str, Any]] = []

    if portfolio_id:
        portfolio = await resolve_portfolio(user_id, portfolio_id=portfolio_id)
        if portfolio and portfolio.get("name"):
            portfolio_name = str(portfolio["name"])

        cert_records = await list_portfolio_snapshot_certificates(user_id, portfolio_id)
        for cert in cert_records:
            all_certs_raw.append({
                "id": cert.id,
                "title": cert.title,
                "note": cert.note,
                "snapshotAt": cert.snapshot_at.isoformat(),
                "certifyMode": cert.certify_mode,
                "achievementKey": cert.achievement_key,
                "nftMintStatus": cert.nft_mint_status,
                "nftTokenId": cert.nft_token_id,
                "nftTxHash": cert.nft_tx_hash,
                "snapshotPayload": cert.snapshot_payload if isinstance(cert.snapshot_payload, dict) else {},
            })

        unlock_records = await list_portfolio_achievement_unlocks(user_id, portfolio_id)
        for unlock in unlock_records:
            metadata = unlock.metadata if isinstance(unlock.metadata, dict) else {}
            all_unlocks_raw.append({
                "achievementKey": unlock.achievement_key,
                "badgeTitle": unlock.achievement.title,
                "metric": unlock.achievement.metric,
                "operator": unlock.achievement.operator,
                "threshold": unlock.achievement.threshold,
                "observedValue": metadata.get("observedValue"),
                "snapshotAt": str(unlock.snapshot_at or ""),
                "certificateId": unlock.certificate_id,
            })

    nfts_by_cert_id: dict[str, dict] = {
        nft["certificateId"]: nft
        for nft in nfts
        if isinstance(nft, dict) and nft.get("certificateId")
    }

    return {
        "portfolio": {
            "name": portfolio_name,
            "dateOfReport": report_date,
            "portfolioId": portfolio_id or None,
        },
        "all_certs": all_certs_raw,
        "all_unlocks": all_unlocks_raw,
        "nfts_by_cert_id": nfts_by_cert_id,
    }


_SHARE_SYSTEM_PROMPT = """\
# Role

You are a **financial storyteller** who turns portfolio data into a clear, engaging investment journey.

# Task

Using the provided list of chronological **milestones**, write a short first-person narrative as if the user were sharing their investment journey on social media.

Each milestone may include:

- Milestone name
- Date or time period
- A short summary
- `portfolio_state`: the portfolio’s value, composition, or status at that point in time

# Content Requirements

- Write in the first person using “I” and “my.”
- Tell the story in strict chronological order.
- Reference every provided milestone naturally.
- For each milestone, focus on:
  - The state of the portfolio at that time
  - Any meaningful change or transition
  - How that moment contributed to the overall journey
- Prioritize the evolution of the portfolio, investment decisions, and measurable changes over emotional storytelling.
- Keep the tone calm, reflective, credible, and conversational.
- Use only light personal reflection to connect different stages of the journey.
- Do not exaggerate gains, losses, success, or setbacks.
- Do not provide financial advice.
- Do not infer market conditions, strategies, motivations, or outcomes unless they are explicitly stated in the input.
- Do not invent numbers, dates, assets, returns, percentages, or events.
- If information is missing, omit it naturally without calling attention to the missing data.
- Do not mention the platform name, blockchain technology, on-chain data, or verification methods unless explicitly requested.

# Data Handling Rules

- Treat all milestones as parts of one continuous investment journey.
- Do not present the information as a report, table, or disconnected list.
- Turn the data into a cohesive narrative while preserving the original meaning.
- Use `portfolio_state` exactly as provided.
- When a milestone includes a name, date, summary, and portfolio state, combine them naturally instead of repeating each field mechanically.
- Preserve the original currency, number formatting, and terminology from the input.

# Output Format

- Write in Markdown.
- Begin with a short title using `##`.
- Use **bold** for milestone names and important portfolio changes.
- Use *italics* for dates and brief reflective phrases.
- Divide the story into 2–4 short paragraphs with clear spacing.
- Do not use tables.
- Avoid bullet points in the final story.
- Keep the total length under 250 words.
- End with a brief, grounded closing line that suggests the journey is still continuing without sounding overly motivational.

# Writing Style

The writing should be:

- First-person
- Chronological
- Clear and cohesive
- Calm and reflective
- Fact-based
- Suitable for social media
- Focused primarily on the portfolio’s development rather than emotion
"""

async def generate_share_narrative(nfts: list[dict]) -> str:
    """Generate a social-share narrative from on-chain verified NFT data."""
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


async def generate_audit_markdown(
    nfts: list[dict],
    *,
    user_id: str,
    portfolio_id: str | None,
) -> str:
    """Generate a markdown audit report from on-chain verified NFT data."""
    state_packet = await _build_audit_packet(user_id=user_id, portfolio_id=portfolio_id, nfts=nfts)
    return _render_audit_markdown(state_packet)


async def generate_audit_report(
    nfts: list[dict],
    *,
    user_id: str,
    portfolio_id: str | None,
) -> str:
    """Backward-compatible wrapper for the markdown audit report."""
    return await generate_audit_markdown(nfts, user_id=user_id, portfolio_id=portfolio_id)
