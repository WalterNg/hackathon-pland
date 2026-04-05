from unittest.mock import AsyncMock, patch

import pytest

from trading_agent.agents.researchers import (
    BEAR_CASE_FALLBACK_MESSAGE,
    BEAR_CASE_FALLBACK_WARNING,
    BearResearcher,
)
from trading_agent.core import ConversationMemory
from trading_agent.schemas.output import DebateTurn


@pytest.mark.asyncio
async def test_bear_researcher_uses_fallback_and_warning_for_empty_message():
    agent = BearResearcher(memory=ConversationMemory("bear_researcher"))
    mock_turn = DebateTurn(speaker="Bear Researcher", stance="Bearish", message="   ")

    with patch.object(agent, "run_structured", new_callable=AsyncMock, return_value=mock_turn):
        result = await agent.run_node({"investment_debate": None, "analyst_reports": None})  # type: ignore[arg-type]

    debate = result["investment_debate"]
    assert debate is not None
    assert debate.bear_case == BEAR_CASE_FALLBACK_MESSAGE
    assert debate.latest_message == BEAR_CASE_FALLBACK_MESSAGE
    assert debate.history[-1].message == BEAR_CASE_FALLBACK_MESSAGE
    assert result["warnings"] == [BEAR_CASE_FALLBACK_WARNING]
    assert result["trace"][0].status == "completed"
    assert "fallback" in result["trace"][0].detail.lower()


@pytest.mark.asyncio
async def test_bear_researcher_keeps_normal_message_without_warning():
    agent = BearResearcher(memory=ConversationMemory("bear_researcher"))
    mock_turn = DebateTurn(speaker="Bear Researcher", stance="Bearish", message="Downside pressure remains elevated.")

    with patch.object(agent, "run_structured", new_callable=AsyncMock, return_value=mock_turn):
        result = await agent.run_node({"investment_debate": None, "analyst_reports": None})  # type: ignore[arg-type]

    debate = result["investment_debate"]
    assert debate is not None
    assert debate.bear_case == "Downside pressure remains elevated."
    assert result["warnings"] == []
    assert result["trace"][0].detail == "Bear case updated."
