import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError
from google.api_core.exceptions import GoogleAPIError

from core.config import settings
from schemas.state import AgentState
from schemas.output import TAResult
from .prompts import TA_SYSTEM_PROMPT

logger = logging.getLogger("hackathon-pland")

async def analyze_technical(state: AgentState) -> AgentState:
    """
    LangGraph node: Analyzes technical indicators and returns a TAResult.
    """
    logger.info("Executing TA Agent analysis.")
    payload = state["payload"]
    market_data = payload.market_data

    # Formatting user input
    user_input = f"""
    Please analyze the following technical indicators for asset in the portfolio:
    RVOL: {market_data.rvol}
    MA50: {market_data.ma50}
    RSI: {market_data.rsi}
    Bollinger Bands: {market_data.bollinger_bands}
    OBV: {market_data.obv}
    """
    
    # Initialize the LLM with structured output
    try:
        # Require API key to be set, fallback to dummy key handled gracefully during    try:
        api_key = settings.gemini_api_key
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in environment")
            
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=api_key,
            temperature=0.0,
            max_retries=3 # F2: Added simple retry logic
        )
        structured_llm = llm.with_structured_output(TAResult)
        
        # Invoke LLM
        messages = [
            ("system", TA_SYSTEM_PROMPT),
            ("human", user_input)
        ]
        
        logger.info("Invoking Gemini for TA evaluation.")
        result: TAResult = await structured_llm.ainvoke(messages)
        logger.info(f"TA Evaluation complete: {result.recommended_action} - Strength: {result.signal_strength}")
        
        return {"ta_result": result}

    except ValidationError as e:
        logger.error(f"TA Agent Output Validation Error: {e}")
        return {"error": "TA Agent returned invalid data format"}
    except GoogleAPIError as e:
        logger.error(f"Google API Error in TA Agent: {e}")
        return {"error": "TA Agent LLM API failed"}
    except Exception as e:
        logger.error(f"Unexpected error in TA Agent: {e}")
        return {"error": f"TA Agent encountered an error: {str(e)}"}
