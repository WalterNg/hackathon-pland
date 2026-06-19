import sys
import os
from pathlib import Path

backend_dir = Path(__file__).parent.absolute()
project_root = backend_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")
load_dotenv(project_root / ".env.local")

from core.logger import setup_logger

setup_logger()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from core.exceptions import global_exception_handler, validation_exception_handler
from api.routes import (
    binance_connection,
    binance_market,
    debug_market,
    evaluate,
    nft_certificate,
    portfolio_achievements,
    portfolio_forecast,
    portfolio_snapshot_certificates,
    risk_agent,
    risk_rules,
    sentiment_agent,
    storytelling,
    ta_agent,
    trading_agent,
)
import logging

logger = logging.getLogger("hackathon-pland")

app = FastAPI(
    title="PLAND",
    description="Multi-Agent System for evaluating crypto portfolios.",
    version="1.0.0"
)

allowed_origins = {
    origin.strip()
    for origin in [
        os.getenv("NEXT_PUBLIC_APP_URL", ""),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    if origin.strip()
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Routers
app.include_router(evaluate.router, prefix="/api", tags=["Evaluation"])
app.include_router(ta_agent.router, prefix="/api", tags=["TA Agent"])
app.include_router(sentiment_agent.router, prefix="/api", tags=["Sentiment Agent"])
app.include_router(risk_agent.router, prefix="/api", tags=["Risk Agent"])
app.include_router(portfolio_forecast.router, prefix="/api", tags=["Portfolio Forecast"])
app.include_router(debug_market.router, prefix="/api", tags=["Debug"])
app.include_router(binance_connection.router, prefix="/api", tags=["Binance Connection"])
app.include_router(binance_market.router, prefix="/api", tags=["Binance Market"])
app.include_router(trading_agent.router, prefix="/api", tags=["Trading Agent"])
app.include_router(portfolio_snapshot_certificates.router, prefix="/api", tags=["Portfolio Snapshot Certificates"])
app.include_router(portfolio_achievements.router, prefix="/api", tags=["Portfolio Achievements"])
app.include_router(nft_certificate.router, prefix="/api", tags=["NFT Certificate Metadata"])
app.include_router(storytelling.router, prefix="/api", tags=["AI Storytelling"])
app.include_router(risk_rules.router, prefix="/api", tags=["Risk Rules"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
