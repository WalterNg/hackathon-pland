from abc import ABC, abstractmethod
from typing import Type

from google.api_core.exceptions import GoogleAPIError
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, ValidationError

from core.config import settings
from trading_agent.config import DEFAULT_TRADING_AGENT_CONFIG


class TradingAgentError(Exception):
    """Raised when the independent trading_agent flow fails."""


class BaseLLMClient(ABC):
    @abstractmethod
    async def invoke_structured(self, system_prompt: str, user_input: str, output_schema: Type[BaseModel]) -> BaseModel:
        raise NotImplementedError


class GeminiClient(BaseLLMClient):
    def __init__(self, model_name: str = DEFAULT_TRADING_AGENT_CONFIG.model_name):
        self.model_name = model_name
        self._llm: ChatGoogleGenerativeAI | None = None

    def _get_llm(self) -> ChatGoogleGenerativeAI:
        if self._llm is None:
            api_key = settings.gemini_api_key
            if not api_key:
                raise TradingAgentError("GEMINI_API_KEY is not set in environment")
            self._llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                api_key=api_key,
                temperature=DEFAULT_TRADING_AGENT_CONFIG.temperature,
                max_retries=DEFAULT_TRADING_AGENT_CONFIG.max_retries,
            )
        return self._llm

    async def invoke_structured(self, system_prompt: str, user_input: str, output_schema: Type[BaseModel]) -> BaseModel:
        try:
            llm = self._get_llm().with_structured_output(output_schema)
            messages = [("system", system_prompt), ("human", user_input)]
            return await llm.ainvoke(messages)
        except ValidationError as exc:
            raise TradingAgentError(f"Structured output validation failed: {exc}") from exc
        except GoogleAPIError as exc:
            raise TradingAgentError(f"Gemini invocation failed: {exc}") from exc
        except Exception as exc:
            raise TradingAgentError(f"Unexpected trading_agent LLM error: {exc}") from exc


def create_llm_client(provider: str = DEFAULT_TRADING_AGENT_CONFIG.llm_provider) -> BaseLLMClient:
    if provider.lower() == "gemini":
        return GeminiClient()
    raise TradingAgentError(f"Unsupported trading_agent provider: {provider}")

