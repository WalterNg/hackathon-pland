import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Type

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, ValidationError
from google.api_core.exceptions import GoogleAPIError

from core.config import settings
from trading_agent.config import DEFAULT_TRADING_AGENT_CONFIG

class AgentError(Exception):
    """Raised when an agent fails to produce a valid result."""
    pass


class BaseAgent(ABC):
    """
    Shared base class for all AI agents.
    Handles LLM initialization, timing, logging, and error wrapping.
    Subclasses only need to implement `run_node`.
    """

    MODEL_NAME = "gemini-2.5-flash"
    TEMPERATURE = 0.0
    MAX_RETRIES = 3

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__.upper())
        self._llm: Any = None

    def _get_llm(self) -> Any:
        """Lazy-initialize and return the shared LLM instance."""
        if self._llm is None:
            provider = DEFAULT_TRADING_AGENT_CONFIG.llm_provider.lower()
            if provider == "openrouter":
                api_key = settings.openrouter_api_key
                if not api_key:
                    raise AgentError("OPENROUTER_API_KEY is not set in environment")
                model = DEFAULT_TRADING_AGENT_CONFIG.model_name
                if model == "gemini-2.5-flash":
                    model = "google/gemini-2.5-flash"
                self._llm = ChatOpenAI(
                    model=model,
                    api_key=api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=self.TEMPERATURE,
                    max_retries=self.MAX_RETRIES,
                )
            else:
                api_key = settings.gemini_api_key
                if not api_key:
                    raise AgentError("GEMINI_API_KEY is not set in environment")
                self._llm = ChatGoogleGenerativeAI(
                    model=self.MODEL_NAME,
                    api_key=api_key,
                    temperature=self.TEMPERATURE,
                    max_retries=self.MAX_RETRIES,
                )
        return self._llm

    async def run(
        self,
        system_prompt: str,
        user_input: str,
        output_schema: Type[BaseModel],
    ) -> Any:
        """
        Invoke the LLM with structured output. Handles timing, logging, and errors.
        Returns a validated Pydantic model instance.
        Raises AgentError on any failure.
        """
        try:
            llm = self._get_llm()
            structured_llm = llm.with_structured_output(output_schema)
            messages = [("system", system_prompt), ("human", user_input)]

            provider_name = DEFAULT_TRADING_AGENT_CONFIG.llm_provider.upper()
            self.logger.info(f"Invoking {provider_name} ({output_schema.__name__})...")

            start = time.perf_counter()
            result = await structured_llm.ainvoke(messages)
            duration = time.perf_counter() - start
            self.logger.info(f"Done in {duration:.2f}s")
            return result

        except ValidationError as e:
            raise AgentError(f"Output schema validation failed: {e}") from e
        except GoogleAPIError as e:
            raise AgentError(f"Gemini API error: {e}") from e
        except Exception as e:
            raise AgentError(f"LLM API error: {e}") from e

