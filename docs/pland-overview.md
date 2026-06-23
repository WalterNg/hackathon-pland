# PLAND Overview

PLAND is an AI-powered crypto portfolio intelligence platform. It combines portfolio tracking, risk monitoring, Binance synchronization, forecasting, and multi-agent AI analysis in one application.

The product is built as a two-layer system:

- A `Next.js` frontend for authentication, portfolio management, dashboards, risk controls, and user-facing workflows.
- A `FastAPI` backend that runs a `LangGraph` multi-agent pipeline for technical analysis, market sentiment, risk assessment, and final recommendation synthesis.

## What PLAND Helps Users Do

PLAND is designed to help crypto investors understand what they own, how their portfolio is performing, what risks are emerging, and what actions may be worth considering next.

Core user goals include:

- Creating and managing multiple portfolios
- Adding manual buy, sell, and transfer transactions
- Syncing portfolios from Binance
- Watching live portfolio snapshots and market updates
- Reviewing portfolio-level risk rules and alerts
- Running AI analysis on a portfolio
- Forecasting future portfolio value
- Saving meaningful portfolio milestones and snapshot certificates

## Main Features

### Portfolio management

Users can create portfolios, switch between them, and keep holdings organized by portfolio. The main dashboard routes users into the primary portfolio workspace by default.

### Transactions and holdings

PLAND supports transaction entry and portfolio history tracking. The portfolio page exposes holdings, transaction lists, and asset-level metrics such as value, quantity, and profit/loss.

### Binance-connected portfolios

For connected portfolios, PLAND can fetch balances from Binance and normalize them into the app's portfolio model. Connected portfolios are read-only in the UI because they are meant to mirror the exchange source of truth.

### Risk management

PLAND includes a dedicated risk workspace with active alerts, recent risk events, and configurable risk rules. The main portfolio can manage global rules across child portfolios, while individual portfolios can review their own alerts.

### Portfolio metrics

The app surfaces a broad set of metrics, including:

- Profit and loss
- Cost basis
- Sharpe ratio
- Max drawdown
- Risk score
- Volatility
- Concentration
- Sortino ratio
- Calmar ratio
- Value at Risk and Expected Shortfall

### Forecasting

PLAND provides a forecast view that projects future portfolio value using historical data and Monte Carlo-style uncertainty framing. The forecast UI emphasizes scenarios and confidence bands instead of a single deterministic number.

### AI analysis

PLAND can analyze a portfolio with a multi-agent AI workflow. The backend breaks the analysis into specialist steps and then combines them into a final recommendation with guardrails.

### Milestones and certificates

PLAND supports portfolio checkpoints, snapshot certificates, and milestone-style achievements. These features turn portfolio events into a visible journey and can be extended into on-chain badge or NFT flows.

### Journal analytics

The codebase also includes journal reporting for portfolio activity, realized PnL, and BTC-normalized performance, even though some of the journal UI is currently hidden from the primary navigation.

## Architecture At A Glance

PLAND is split into frontend, API, and backend responsibilities:

- `Next.js` owns the user interface, route handlers, Supabase integration, and presentation logic.
- `Supabase` handles authentication and persistent portfolio data.
- `FastAPI` owns the evaluation backend and exchange connector routes.
- `LangGraph` coordinates the AI specialists that power portfolio analysis.
- `Binance` provides exchange balances, market data, and live price updates.

This separation keeps the product responsive in the browser while allowing the AI and data-heavy workflows to run in a dedicated backend.

## Short Summary

If you want the shortest description possible, PLAND is:

> A crypto portfolio intelligence app that combines tracking, risk management, Binance sync, forecasting, and multi-agent AI recommendations.
