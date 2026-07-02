# Directional Forecast Evaluation Results

**Table 1. Directional Forecast Evaluation Configuration**

| Evaluation parameter | Value |
|:--|--:|
| Number of days | 114 |
| Dead zone | 5% |
| Forecast horizon | 7 days |
| Baseline directional accuracy | 33% |
| **Proposed directional accuracy** | **≈57%** |

*Note.* The baseline accuracy corresponds to a three-class directional classification setting comprising Up, Down, and Neutral movements.

---

**Table 2. Class-wise Directional Classification Performance**

| Class | Precision | Recall | F1-score | Support |
|:--|--:|--:|--:|--:|
| Up | 63.8% | 54.5% | 58.8% | 55 |
| Down | 51.6% | 68.1% | 58.7% | 47 |
| Neutral | 60.0% | 25.0% | 35.3% | 12 |
| **Predicted total** | **47** | **62** | **5** | **114** |

*Note.* Support denotes the number of actual observations in each class. The predicted totals indicate 47 Up predictions, 62 Down predictions, and 5 Neutral predictions, for a total of 114 observations.
