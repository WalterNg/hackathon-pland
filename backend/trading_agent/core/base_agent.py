import logging
from typing import Type

from pydantic import BaseModel

from trading_agent.core.llm_clients import TradingAgentError, create_llm_client


class TradingRoleAgent:
    system_prompt: str = ""
    output_schema: Type[BaseModel]

    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"TRADING_AGENT.{name.upper()}")
        self.llm_client = create_llm_client()

    async def run_structured(self, user_input: str) -> BaseModel:
        if not self.system_prompt:
            raise TradingAgentError(f"{self.name} is missing a system prompt")
        return await self.llm_client.invoke_structured(self.system_prompt, user_input, self.output_schema)

