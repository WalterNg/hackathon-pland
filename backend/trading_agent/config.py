from dataclasses import dataclass


@dataclass(frozen=True)
class TradingAgentConfig:
    llm_provider: str = "gemini"
    model_name: str = "gemini-2.5-flash"
    temperature: float = 0.2
    max_retries: int = 3
    investment_debate_rounds: int = 1
    risk_debate_rounds: int = 1
    recursion_limit: int = 100


DEFAULT_TRADING_AGENT_CONFIG = TradingAgentConfig()

