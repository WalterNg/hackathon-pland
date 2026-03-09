import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError
from google.api_core.exceptions import GoogleAPIError

from core.config import settings
from schemas.state import AgentState
from schemas.output import RiskResult
from .prompts import RISK_SYSTEM_PROMPT

logger = logging.getLogger("hackathon-pland")

async def analyze_risk(state: AgentState) -> AgentState:
    """
    LangGraph node: Analyzes portfolio and market volatility to assign a Risk Level.
    """
    logger.info("Executing Risk Agent analysis.")
    payload = state["payload"]
    portfolio = payload.portfolio
    stablecoin_reserve = payload.stablecoin_reserve
    market_data = payload.market_data

    # Calculate total portfolio value (F3: Guard against zero/missing prices)
    total_assets_value = 0.0
    for item in portfolio:
        price = item.current_price or 0.0
        if price <= 0:
            logger.warning(f"Portfolio asset {item.asset} has invalid price: {price}")
        total_assets_value += item.amount * price
        
    total_value = total_assets_value + stablecoin_reserve

    user_input = f"""
    Please analyze the risk level for the following context:
    
    Total Value: ${total_value:.2f}
    Stablecoin Reserve: ${stablecoin_reserve:.2f}
    Number of Assets: {len(portfolio)}
    
    Market Data:
    RVOL: {market_data.rvol}
    MA50: {market_data.ma50}
    RSI: {market_data.rsi}
    """
    
    try:
        api_key = settings.gemini_api_key
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in environment")

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=api_key,
            temperature=0.0,
            max_retries=3 # F2: Added simple retry logic
        )
        structured_llm = llm.with_structured_output(RiskResult)
        
        messages = [
            ("system", RISK_SYSTEM_PROMPT),
            ("human", user_input)
        ]
        
        logger.info("Invoking Gemini for Risk evaluation.")
        result: RiskResult = await structured_llm.ainvoke(messages)
        logger.info(f"Risk Evaluation complete: {result.risk_level}")
        
        return {"risk_result": result}

    except ValidationError as e:
        logger.error(f"Risk Agent Output Validation Error: {e}")
        return {"error": "Risk Agent returned invalid data format"}
    except GoogleAPIError as e:
        logger.error(f"Google API Error in Risk Agent: {e}")
        return {"error": "Risk Agent LLM API failed"}
    except Exception as e:
        logger.error(f"Unexpected error in Risk Agent: {e}")
        return {"error": f"Risk Agent encountered an error: {str(e)}"}
