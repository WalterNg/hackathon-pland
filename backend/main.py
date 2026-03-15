import sys
import os
from pathlib import Path

backend_dir = Path(__file__).parent.absolute()
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from core.logger import setup_logger
setup_logger()

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from core.exceptions import global_exception_handler, validation_exception_handler
from api.routes import evaluate, ta_agent
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

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
