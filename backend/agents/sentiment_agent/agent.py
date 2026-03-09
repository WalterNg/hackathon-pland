import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError
from google.api_core.exceptions import GoogleAPIError

from core.config import settings
from schemas.state import AgentState
from schemas.output import SentimentResult
from .prompts import SENTIMENT_SYSTEM_PROMPT

logger = logging.getLogger("hackathon-pland")

async def analyze_sentiment(state: AgentState) -> AgentState:
    """
    LangGraph node: Analyzes news headlines and social metrics to return a SentimentResult.
    """
    logger.info("Executing Sentiment Agent analysis.")
    payload = state["payload"]
    headlines = payload.news_headlines
    social_dominance = payload.social_dominance

    # If no data is available
    if not headlines and not social_dominance:
        logger.info("No sentiment data provided, defaulting to neutral.")
        return {"sentiment_result": SentimentResult(
            sentiment_score=50,
            narrative_summary="No significant news or social data provided.",
            bias="Neutral"
        )}

    # Formatting user input
    user_input = f"""
    Please analyze the following sentiment indicators:
    News Headlines:
    {chr(10).join([f"- {h}" for h in headlines])}
    
    Social Dominance: {social_dominance}%
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
        structured_llm = llm.with_structured_output(SentimentResult)
        
        messages = [
            ("system", SENTIMENT_SYSTEM_PROMPT),
            ("human", user_input)
        ]
        
        logger.info("Invoking Gemini for Sentiment evaluation.")
        result: SentimentResult = await structured_llm.ainvoke(messages)
        logger.info(f"Sentiment Evaluation complete: {result.bias} - Score: {result.sentiment_score}")
        
        return {"sentiment_result": result}

    except ValidationError as e:
        logger.error(f"Sentiment Agent Output Validation Error: {e}")
        return {"error": "Sentiment Agent returned invalid data format"}
    except GoogleAPIError as e:
        logger.error(f"Google API Error in Sentiment Agent: {e}")
        return {"error": "Sentiment Agent LLM API failed"}
    except Exception as e:
        logger.error(f"Unexpected error in Sentiment Agent: {e}")
        return {"error": f"Sentiment Agent encountered an error: {str(e)}"}
