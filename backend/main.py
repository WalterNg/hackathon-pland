import sys
import os
from pathlib import Path

backend_dir = Path(__file__).parent.absolute()
project_root = backend_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from dotenv import load_dotenv
load_dotenv(project_root / ".env.local")
load_dotenv(project_root / ".env")

from core.logger import setup_logger

setup_logger()

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from core.exceptions import global_exception_handler, validation_exception_handler
from api.routes import debug_market, evaluate, ta_agent, sentiment_agent, risk_agent, binance_connection
import logging

logger = logging.getLogger("hackathon-pland")

app = FastAPI(
    title="PLAND",
    description="Multi-Agent System for evaluating crypto portfolios.",
    version="1.0.0"
)

# Exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Routers
app.include_router(evaluate.router, prefix="/api", tags=["Evaluation"])
app.include_router(ta_agent.router, prefix="/api", tags=["TA Agent"])
app.include_router(sentiment_agent.router, prefix="/api", tags=["Sentiment Agent"])
app.include_router(risk_agent.router, prefix="/api", tags=["Risk Agent"])
app.include_router(debug_market.router, prefix="/api", tags=["Debug"])
app.include_router(binance_connection.router, prefix="/api", tags=["Binance Connection"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
