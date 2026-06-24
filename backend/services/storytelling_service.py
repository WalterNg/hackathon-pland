from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from core.config import settings
from services.portfolio_snapshot_certificate_store import (
    get_latest_portfolio_snapshot,
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


def _render_audit_markdown(state_packet: dict[str, Any]) -> str:
    """Render the audit report directly from the authoritative state packet."""
    portfolio = state_packet.get("portfolio") if isinstance(state_packet.get("portfolio"), dict) else {}
    snapshot = state_packet.get("snapshot") if isinstance(state_packet.get("snapshot"), dict) else {}
    derived = state_packet.get("derived") if isinstance(state_packet.get("derived"), dict) else {}
    checkpoints = state_packet.get("checkpoints") if isinstance(state_packet.get("checkpoints"), list) else []
    risk_violations = snapshot.get("riskViolations") if isinstance(snapshot.get("riskViolations"), list) else []

    summary_rows = [
        ["Portfolio Name", portfolio.get("name")],
        ["Portfolio Manager", portfolio.get("manager")],
        ["Benchmark", portfolio.get("benchmark")],
        ["Date of Report", portfolio.get("dateOfReport")],
        ["Investment Objective", portfolio.get("objective")],
        ["Portfolio ID", portfolio.get("portfolioId")],
        ["Snapshot ID", snapshot.get("snapshotId")],
        ["Snapshot At", snapshot.get("snapshotAt")],
        ["Total Value USD", derived.get("totalValueUsd")],
        ["Cash Ratio", derived.get("cashRatio")],
        ["Asset Count", derived.get("assetCount")],
        ["Distinct Assets", derived.get("distinctAssets")],
    ]
    summary_rows = [row for row in summary_rows if _is_present(row[1])]

    performance_rows = [
        ["Period Start Value", derived.get("chart", {}).get("start") if isinstance(derived.get("chart"), dict) else None],
        ["Period End Value", derived.get("chart", {}).get("end") if isinstance(derived.get("chart"), dict) else None],
        ["Period Return", derived.get("chart", {}).get("periodReturn") if isinstance(derived.get("chart"), dict) else None],
        ["Annualized Return", derived.get("chart", {}).get("annualizedReturn") if isinstance(derived.get("chart"), dict) else None],
    ]
    performance_rows = [row for row in performance_rows if _is_present(row[1])]

    metrics_rows = _non_empty_dict_rows(snapshot.get("metrics") if isinstance(snapshot.get("metrics"), dict) else {}, exclude={"timestamp"})

    holdings_rows = _holdings_rows(derived.get("topHoldings") if isinstance(derived.get("topHoldings"), list) else [])
    violation_rows = _violation_rows([item for item in risk_violations if isinstance(item, dict)])
    checkpoint_rows = _checkpoint_rows([item for item in checkpoints if isinstance(item, dict)])

    strengths: list[list[Any]] = []
    if _is_present(checkpoint_rows):
        strengths.append(["On-chain checkpoints", f"{len(checkpoint_rows)} certificate{'' if len(checkpoint_rows) == 1 else 's'} were read successfully."])
    if _is_present(holdings_rows):
        strengths.append(["Holdings captured", f"{len(holdings_rows)} top holdings were available in the snapshot packet."])

    weaknesses: list[list[Any]] = []
    if violation_rows:
        for violation in [item for item in risk_violations if isinstance(item, dict)]:
            weaknesses.append([
                violation.get("title") or violation.get("event_type") or "Risk violation",
                violation.get("message") or violation.get("severity") or "",
            ])
    else:
        weaknesses.append(["Risk violations", "No active risk violations were included in the latest snapshot packet."])

    recommendations: list[list[Any]] = []
    if violation_rows:
        for violation in [item for item in risk_violations if isinstance(item, dict)]:
            recommendations.append([
                violation.get("title") or violation.get("event_type") or "Action",
                _recommendation_for_violation(violation),
            ])
    else:
        recommendations.append(["Maintain controls", "No corrective action is required from the current snapshot data alone."])

    sections: list[str] = ["# AUDIT PORTFOLIO PERFORMANCE REPORT"]
    sections.append(_render_key_value_section("1. Executive Summary", summary_rows))
    sections.append(_render_key_value_section("2. Performance Snapshot", performance_rows))

    if metrics_rows or violation_rows:
        risk_body_parts: list[str] = []
        if metrics_rows:
            risk_body_parts.append("### Snapshot Metrics\n\n" + _bullet_list(metrics_rows))
        if violation_rows:
            violation_bullets: list[str] = []
            for row in violation_rows:
                event_type, severity, title, message, observed_value, threshold_value, symbol = row
                details = []
                if _is_present(severity):
                    details.append(f"Severity: {_escape_markdown_cell(severity)}")
                if _is_present(message):
                    details.append(f"Message: {_escape_markdown_cell(message)}")
                if _is_present(observed_value):
                    details.append(f"Observed: {_escape_markdown_cell(observed_value)}")
                if _is_present(threshold_value):
                    details.append(f"Threshold: {_escape_markdown_cell(threshold_value)}")
                if _is_present(symbol):
                    details.append(f"Symbol: {_escape_markdown_cell(symbol)}")
                head = _escape_markdown_cell(title or event_type or "Risk violation")
                suffix = f" ({_escape_markdown_cell(event_type)})" if _is_present(event_type) else ""
                bullet = f"- **{head}**{suffix}"
                if details:
                    bullet += " - " + "; ".join(details)
                violation_bullets.append(bullet)
            risk_body_parts.append("### Active Risk Violations\n\n" + "\n".join(violation_bullets))
        sections.append(_render_section("3. Risk & Violations", "\n\n".join(risk_body_parts)))

    if holdings_rows:
        holdings_bullets = [
            "- **{symbol}:** Weight {weight}, Quantity {quantity}, Current Price {price}, Value {value}".format(
                symbol=_escape_markdown_cell(row[0]),
                weight=_escape_markdown_cell(row[1]),
                quantity=_escape_markdown_cell(row[2]),
                price=_escape_markdown_cell(row[3]),
                value=_escape_markdown_cell(row[4]),
            )
            for row in holdings_rows
        ]
        sections.append(_render_section("4. Holdings Snapshot", "\n".join(holdings_bullets)))

    if checkpoint_rows:
        checkpoint_bullets = [
            "- **{badge}** ({date}) - {criterion}; Hash verified: {hash_verified}; Proof: {proof}".format(
                badge=_escape_markdown_cell(row[0]),
                date=_escape_markdown_cell(row[1]),
                criterion=_escape_markdown_cell(row[2]),
                hash_verified=_escape_markdown_cell(row[3]),
                proof=_escape_markdown_cell(row[4]),
            )
            for row in checkpoint_rows
        ]
        sections.append(_render_section("5. Checkpoints", "\n".join(checkpoint_bullets)))

    findings_parts: list[str] = []
    if strengths:
        findings_parts.append("### Strengths\n\n" + _bullet_list(strengths))
    findings_parts.append("### Weaknesses / Findings\n\n" + _bullet_list(weaknesses))
    findings_parts.append("### Recommendations\n\n" + _bullet_list(recommendations))
    sections.append(_render_section("6. Findings & Actions", "\n\n".join(findings_parts)))

    return "\n\n---\n\n".join(section for section in sections if section)


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
    """Build the audit state packet from portfolio snapshots and verified NFTs."""
    portfolio_name: str | None = None
    snapshot_payload: dict[str, Any] | None = None
    snapshot_at: str | None = None
    latest_snapshot_id: str | None = None

    if portfolio_id:
        portfolio = await resolve_portfolio(user_id, portfolio_id=portfolio_id)
        if portfolio and portfolio.get("name"):
            portfolio_name = str(portfolio["name"])

        latest_snapshot = await get_latest_portfolio_snapshot(portfolio_id, user_id)
        if isinstance(latest_snapshot, dict):
            latest_snapshot_id = str(latest_snapshot.get("id") or "")
            snapshot_at_raw = latest_snapshot.get("snapshot_at")
            snapshot_at = snapshot_at_raw.isoformat() if isinstance(snapshot_at_raw, datetime) else str(snapshot_at_raw or "")
            raw_payload = latest_snapshot.get("metadata")
            if isinstance(raw_payload, dict):
                snapshot_payload = raw_payload

    summary = snapshot_payload.get("summary") if isinstance(snapshot_payload, dict) and isinstance(snapshot_payload.get("summary"), dict) else {}
    metrics = snapshot_payload.get("metrics") if isinstance(snapshot_payload, dict) and isinstance(snapshot_payload.get("metrics"), dict) else {}
    chart = snapshot_payload.get("chart") if isinstance(snapshot_payload, dict) and isinstance(snapshot_payload.get("chart"), list) else []
    assets = snapshot_payload.get("assets") if isinstance(snapshot_payload, dict) and isinstance(snapshot_payload.get("assets"), list) else []
    risk_violations = snapshot_payload.get("riskViolations") if isinstance(snapshot_payload, dict) and isinstance(snapshot_payload.get("riskViolations"), list) else []

    top_holdings: list[dict[str, Any]] = []
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        top_holdings.append({
            "symbol": asset.get("symbol"),
            "weight": asset.get("weight"),
            "quantity": asset.get("quantity"),
            "currentPrice": asset.get("currentPrice"),
            "valueUsd": asset.get("valueUsd"),
        })
    top_holdings = sorted(
        top_holdings,
        key=lambda item: float(item.get("valueUsd") or 0),
        reverse=True,
    )[:5]

    checkpoints = []
    for nft in nfts:
        checkpoints.append({
            "badge": nft.get("title") or nft.get("achievementKey") or "Certified Snapshot",
            "date": (nft.get("snapshotAt") or "")[:10] or None,
            "criterion": _ACHIEVEMENT_CRITERIA.get(str(nft.get("achievementKey") or ""), "Portfolio checkpoint certified on-chain"),
            "hashVerified": nft.get("hashVerified"),
            "onChainProof": nft.get("etherscanUrl"),
        })

    report_date = datetime.now(timezone.utc).date().isoformat()
    chart_summary = _chart_summary([item for item in chart if isinstance(item, dict)])

    return {
        "portfolio": {
            "name": portfolio_name,
            "manager": None,
            "benchmark": None,
            "dateOfReport": report_date,
            "objective": None,
            "portfolioId": portfolio_id or None,
        },
        "snapshot": {
            "snapshotId": latest_snapshot_id or None,
            "snapshotAt": _format_iso_date(snapshot_at) or None,
            "summary": _safe_json(summary),
            "metrics": _safe_json(metrics),
            "riskViolations": _safe_json(risk_violations),
        },
        "derived": {
            "totalValueUsd": _format_currency(summary.get("totalValueUsd") if isinstance(summary, dict) else None) or None,
            "cashRatio": _format_ratio_percent(summary.get("cashRatio") if isinstance(summary, dict) else None) or None,
            "distinctAssets": len(assets),
            "assetCount": len(assets),
            "chart": chart_summary,
            "topHoldings": _safe_json(top_holdings),
        },
        "checkpoints": _safe_json(checkpoints),
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
