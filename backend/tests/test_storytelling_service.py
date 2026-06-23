import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from services.storytelling_service import _render_audit_markdown, generate_audit_markdown


def _build_audit_packet_fixture() -> dict:
    return {
        "portfolio": {
            "name": "Alpha Fund",
            "manager": None,
            "benchmark": None,
            "dateOfReport": "2026-06-21",
            "objective": None,
            "portfolioId": "portfolio_123",
        },
        "snapshot": {
            "snapshotId": "snapshot_456",
            "snapshotAt": "2026-06-20",
            "summary": {
                "totalValueUsd": 25000.0,
                "cashRatio": 0.05,
            },
            "metrics": {
                "maxDrawdownPercent": 3.25,
                "riskScore": 82,
                "timestamp": "2026-06-20T00:00:00Z",
            },
            "riskViolations": [
                {
                    "event_type": "position_limit_breach",
                    "severity": "high",
                    "title": "ETH allocation too large",
                    "message": "ETHUSDT allocation exceeded the configured limit.",
                    "observed_value": 0.42,
                    "threshold_value": 0.2,
                    "symbol": "ETHUSDT",
                }
            ],
        },
        "derived": {
            "totalValueUsd": "$25,000.00",
            "cashRatio": "5.00%",
            "distinctAssets": 2,
            "assetCount": 3,
            "chart": {
                "start": "$20,000.00",
                "end": "$25,000.00",
                "periodReturn": "25.00%",
                "annualizedReturn": "112.50%",
            },
            "topHoldings": [
                {
                    "symbol": "ETHUSDT",
                    "weight": 0.42,
                    "quantity": 10,
                    "currentPrice": 2100,
                    "valueUsd": 21000,
                },
                {
                    "symbol": "BTCUSDT",
                    "weight": 0.08,
                    "quantity": 0.2,
                    "currentPrice": 40000,
                    "valueUsd": 4000,
                },
            ],
        },
        "checkpoints": [
            {
                "badge": "Seed Sower",
                "date": "2026-06-18",
                "criterion": "Held at least 5 distinct assets",
                "hashVerified": True,
                "onChainProof": "https://etherscan.io/tx/0xabc",
            }
        ],
    }


def test_render_audit_markdown_uses_packet_values_and_omits_template_noise():
    markdown = _render_audit_markdown(_build_audit_packet_fixture())

    assert markdown.startswith("# AUDIT PORTFOLIO PERFORMANCE REPORT")
    assert "Alpha Fund" in markdown
    assert "2026-06-21" in markdown
    assert "$25,000.00" in markdown
    assert "ETH allocation too large" in markdown
    assert "ETHUSDT" in markdown
    assert "Seed Sower" in markdown
    assert "25.00%" in markdown
    assert "- **Portfolio Name:**" in markdown
    assert "| Field | Value |" not in markdown
    assert "| Metric | Value |" not in markdown
    assert "N/A" not in markdown
    assert "template" not in markdown.lower()
    assert "{{" not in markdown
    assert "}}" not in markdown


@pytest.mark.asyncio
@patch("services.storytelling_service._build_audit_packet", new_callable=AsyncMock)
@patch("services.storytelling_service._get_llm", new_callable=Mock)
async def test_generate_audit_markdown_bypasses_llm(mock_get_llm, mock_build_audit_packet):
    packet = _build_audit_packet_fixture()
    mock_build_audit_packet.return_value = packet

    markdown = await generate_audit_markdown(
        [],
        user_id="user_123",
        portfolio_id="portfolio_123",
    )

    assert markdown == _render_audit_markdown(packet)
    mock_build_audit_packet.assert_awaited_once_with(
        user_id="user_123",
        portfolio_id="portfolio_123",
        nfts=[],
    )
    mock_get_llm.assert_not_called()
