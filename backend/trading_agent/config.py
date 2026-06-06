import yaml
from pathlib import Path
from dataclasses import dataclass

# Locate backend/trading_agent/config.yaml
CURRENT_DIR = Path(__file__).parent.absolute()
yaml_path = CURRENT_DIR / "config.yaml"

if not yaml_path.exists():
    raise FileNotFoundError(f"Configuration file not found: {yaml_path}.")

with open(yaml_path, "r", encoding="utf-8") as f:
    yaml_config = yaml.safe_load(f)

if yaml_config is None:
    yaml_config = {}


@dataclass(frozen=True)
class TradingAgentConfig:
    # LLM Settings
    llm_provider: str = yaml_config.get("llm", {}).get("provider", "openrouter")
    model_name: str = yaml_config.get("llm", {}).get("model_name", "google/gemini-2.5-flash")
    temperature: float = float(yaml_config.get("llm", {}).get("temperature", 0.2))
    max_retries: int = int(yaml_config.get("llm", {}).get("max_retries", 3))

    # Agent Settings
    investment_debate_rounds: int = int(yaml_config.get("trading_agent", {}).get("investment_debate_rounds", 1))
    risk_debate_rounds: int = int(yaml_config.get("trading_agent", {}).get("risk_debate_rounds", 1))
    recursion_limit: int = int(yaml_config.get("trading_agent", {}).get("recursion_limit", 100))


DEFAULT_TRADING_AGENT_CONFIG = TradingAgentConfig()

