# AUDIT PORTFOLIO PERFORMANCE REPORT

**Purpose:** Canonical audit output for AI Storytelling `audit` mode.  
**Language:** English only.  
**Core rule:** Use only values supported by the portfolio state packet.  
**Missing data rule:** If a value is not supported, omit the line, row, bullet, table cell, or subsection entirely. Do not write `N/A`.
**Formatting rule:** Use tables wherever they make the audit easier to read. The exact headings may vary, but the report should still cover the six audit areas below.

---

## Suggested Structure

The model may adjust headings for readability, but the report should still include content for these six areas:

1. Executive Summary
2. Performance Attribution
3. Risk-Adjusted Performance
4. Compliance Audit
5. Fees & Turnover
6. Findings & Actions

---

## 1. Executive Summary

Use only supported portfolio data.

| Field | Value |
| :--- | :--- |
| Portfolio Name | `{portfolio_name}` |
| Portfolio Manager | `{portfolio_manager}` |
| Benchmark | `{benchmark}` |
| Date of Report | `{date_of_report}` |
| Investment Objective | `{investment_objective}` |

If a field is missing, omit the row.

---

## 2. Performance Attribution

### Portfolio vs. Benchmark Comparison

| Metric | Portfolio | Benchmark | Difference / Alpha |
| :--- | :---: | :---: | :---: |
| Return | `{portfolio_return}` | `{benchmark_return}` | `{return_alpha}` |
| YTD Return | `{portfolio_ytd_return}` | `{benchmark_ytd_return}` | `{ytd_alpha}` |
| Annualized Return | `{portfolio_annualized_return}` | `{benchmark_annualized_return}` | `{annualized_alpha}` |

### Attribution Notes

| Topic | Observation |
| :--- | :--- |
| Best-contributing asset group | `{best_contributing_asset_group}` |
| Weakest-contributing asset group | `{worst_contributing_asset_group}` |
| Stock selection assessment | `{stock_selection_assessment}` |

If benchmark comparison or attribution notes are unsupported, omit the relevant rows or table.

---

## 3. Risk-Adjusted Performance

| Metric | Value | Interpretation |
| :--- | :---: | :--- |
| Standard Deviation | `{standard_deviation}` | Portfolio volatility |
| Sharpe Ratio | `{sharpe_ratio}` | Return per unit of risk |
| Beta | `{beta}` | Sensitivity versus the market |
| Maximum Drawdown | `{maximum_drawdown}` | Largest peak-to-trough loss |
| Value at Risk (VaR) | `{var}` | Potential loss under normal conditions |

Omit any unsupported metric.

---

## 4. Compliance Audit

### Allocation Check

| Asset Class | Actual | Target | Deviation | Status |
| :--- | :---: | :---: | :---: | :---: |
| Equities | `{equities_actual}` | `{equities_target}` | `{equities_deviation}` | `{equities_status}` |
| Fixed Income | `{fixed_income_actual}` | `{fixed_income_target}` | `{fixed_income_deviation}` | `{fixed_income_status}` |
| Cash & Equivalents | `{cash_actual}` | `{cash_target}` | `{cash_deviation}` | `{cash_status}` |

### Investment Breaches

| Breach | Detail |
| :--- | :--- |
| 1 | `{breach_1}` |
| 2 | `{breach_2}` |

If there are no breaches, omit the breaches table entirely.

---

## 5. Fees & Turnover

| Metric | Value | Comment |
| :--- | :---: | :--- |
| Turnover Rate | `{turnover_rate}` | Trading frequency versus strategy intent |
| Transaction Costs | `{transaction_costs}` | Total execution cost |
| Management Fees & Hidden Fees | `{management_fees}` | Fee burden |
| Fee Impact on Performance | `{fee_impact_assessment}` | Net effect on returns |

If fee data is missing, omit the row.

---

## 6. Findings & Actions

### Strengths

| Strength | Detail |
| :--- | :--- |
| 1 | `{strength_1}` |
| 2 | `{strength_2}` |

### Weaknesses / Findings

| Finding | Detail |
| :--- | :--- |
| 1 | `{weakness_1}` |
| 2 | `{weakness_2}` |

### Recommendations

| Action | Detail |
| :--- | :--- |
| 1 | `{action_1}` |
| 2 | `{action_2}` |

If a strength, weakness, or action is not supported, omit the row.

---

## Output Rules

- Use only facts supported by the portfolio state packet and checkpoint data.
- Do not invent benchmark values, manager names, target allocations, or fee values.
- Omit any unsupported field, row, bullet, table cell, or subsection.
- Keep the tone concise, factual, and audit-oriented.
- Prefer tables for comparisons, allocations, risk metrics, breaches, and recommendations when useful.
