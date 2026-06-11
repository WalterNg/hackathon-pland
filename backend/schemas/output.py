from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class PortfolioTAResult(BaseModel):
    portfolio_trend: Literal["Bullish", "Bearish", "Neutral"]
    signal_strength: int = Field(..., ge=1, le=10)
    strongest_positions: List[str] = Field(default_factory=list)
    weakest_positions: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(..., min_length=2)
    recommended_action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance"]


class PortfolioNewsMarketResult(BaseModel):
    market_bias: Literal["Bullish", "Bearish", "Neutral"]
    confidence: int = Field(..., ge=1, le=10)
    key_catalysts: List[str] = Field(default_factory=list)
    portfolio_headwinds: List[str] = Field(default_factory=list)
    narrative_summary: str


class PortfolioRiskResult(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    risk_alerts: List[str] = Field(default_factory=list)
    recommended_constraints: List[str] = Field(default_factory=list)
    capital_preservation_bias: Literal["Bullish", "Neutral", "Defensive"]


class PortfolioDecision(BaseModel):
    action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance", "Stop Loss"]
    confidence: int = Field(..., ge=1, le=10)
    summary: str
    reasoning: List[str] = Field(..., min_length=2)
    portfolio_actions: List[str] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    status: str = "success"
    data: dict


class PortfolioForecastAssetProjection(BaseModel):
    """Per-asset contribution in the portfolio forecast output."""

    symbol: str
    current_value_usd: float = Field(..., ge=0)
    predicted_return_pct: float
    forecast_value_usd: float = Field(..., ge=0)
    change_abs_usd: float
    contribution_pct: float


class PortfolioForecastData(BaseModel):
    """Normalized portfolio forecast payload returned by the prediction API."""

    status: Literal["ready"]
    horizon_hours: int = Field(..., ge=1)
    forecast_portfolio_value: float = Field(..., ge=0)
    forecast_lower: float = Field(..., ge=0)
    forecast_upper: float = Field(..., ge=0)
    forecast_change_abs: float
    forecast_change_pct: float
    confidence_score: int = Field(..., ge=1, le=10)
    artifact_timestamp: str
    predictions_by_symbol: Dict[str, float]
    asset_breakdown: List[PortfolioForecastAssetProjection] = Field(default_factory=list)


class PortfolioForecastResponse(BaseModel):
    """API wrapper for the portfolio forecast endpoint."""

    status: Literal["success", "error"]
    data: Optional[PortfolioForecastData] = None
    message: Optional[str] = None


class BinanceConnectionAsset(BaseModel):
    """Normalized Binance balance entry with free, locked, and estimated USD value."""

    asset: str = Field(..., description="Normalized asset symbol returned by Binance.")
    free: float = Field(..., ge=0, description="Available balance that can be traded or withdrawn.")
    locked: float = Field(..., ge=0, description="Balance currently locked in orders or holds.")
    quantity: float = Field(..., ge=0, description="Total asset quantity calculated as free plus locked.")
    price_usd: float = Field(..., ge=0, description="Estimated USD price used for preview valuation.")
    estimated_usd: float = Field(..., ge=0, description="Estimated USD value for this asset balance.")
    is_stablecoin: bool = Field(default=False, description="Whether the asset is treated as a stablecoin.")


class BinanceConnectionWarning(BaseModel):
    """Warning emitted while building a Binance connection preview."""

    code: str = Field(..., description="Machine-readable warning code.")
    message: str = Field(..., description="Human-readable warning message.")
    severity: Literal["info", "warning", "critical"] = Field(..., description="Warning severity level.")


class BinanceConnectionAccountInfo(BaseModel):
    """Account-level metadata returned by the Binance preview connector."""

    account_type: str | None = Field(default=None, description="Binance account type, if available.")
    can_trade: bool = Field(default=False, description="Whether the account can place trades.")
    can_withdraw: bool = Field(default=False, description="Whether the account can withdraw funds.")
    can_deposit: bool = Field(default=False, description="Whether the account can deposit funds.")
    update_time: int | None = Field(default=None, description="Binance server timestamp for the account snapshot.")


class BinanceConnectionTotals(BaseModel):
    """Aggregate counts and valuation totals for a Binance connection preview."""

    asset_count: int = Field(..., ge=0, description="Total number of assets included in the preview.")
    non_zero_asset_count: int = Field(..., ge=0, description="Number of assets with a positive balance.")
    total_estimated_usd: float = Field(..., ge=0, description="Total estimated USD value across all assets.")


class BinanceConnectionPreviewData(BaseModel):
    """Full preview payload for a Binance-connected portfolio setup."""

    exchange: Literal["binance"] = Field(default="binance", description="Exchange source for the preview.")
    account: BinanceConnectionAccountInfo = Field(..., description="Basic metadata for the connected account.")
    assets: List[BinanceConnectionAsset] = Field(default_factory=list, description="Normalized asset balances.")
    totals: BinanceConnectionTotals = Field(..., description="Aggregate totals for the preview.")
    warnings: List[BinanceConnectionWarning] = Field(default_factory=list, description="Warnings surfaced during preview generation.")


class BinanceConnectionPreviewResponse(BaseModel):
    """API wrapper for Binance connection preview results."""

    status: str = Field(default="success", description="Overall request status.")
    data: BinanceConnectionPreviewData = Field(..., description="Preview payload returned by the Binance connector.")


class BinanceConnectedPosition(BaseModel):
    """Normalized live position used by connected portfolio sync flows."""

    symbol: str = Field(..., description="Resolved trading symbol for the connected asset.")
    quantity: float = Field(..., ge=0, description="Live quantity returned by Binance.")
    avg_buy_price_usd: float = Field(..., ge=0, description="Reference USD price used as a temporary cost basis.")


class BinanceConnectedPositionsResponse(BaseModel):
    """API wrapper for normalized connected portfolio positions."""

    status: str = Field(default="success", description="Overall request status.")
    data: List[BinanceConnectedPosition] = Field(
        default_factory=list,
        description="Normalized connected portfolio positions ready for snapshot sync.",
    )
