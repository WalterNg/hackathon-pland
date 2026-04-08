# Dataset Description: model_dataset_15m_asset_panel.csv

## Tổng quan bộ dữ liệu (Dataset Summary)

*   **Thời gian**: Từ `2026-02-01 00:00:00` đến `2026-04-07 23:59:59`.
*   **Số lượng tài sản (Symbols)**: 20 mã (bao gồm BTCUSDT, ETHUSDT, SOLUSDT, AVAXUSDT, v.v.).
*   **Tổng số dòng (Total Rows)**: ~121.136 dòng.
*   **Tần suất (Interval)**: 15 phút (15m).
*   **Cấu trúc**: Panel data dạng dài (Long format), mỗi dòng đại diện cho một cặp `(symbol, open_time)`.

Tài liệu này mô tả chi tiết các cột thông tin có trong bộ dữ liệu `model_dataset_15m_asset_panel.csv`, được sử dụng để huấn luyện và đánh giá các mô hình dự báo tài sản trong hệ thống PLAND.

## 1. Cột định danh và thời gian

*   **symbol**: Mã tài sản giao dịch (ví dụ: `BTCUSDT`, `ETHUSDT`). Đây là khóa định danh tài sản trong panel.
*   **open_time**: Thời điểm bắt đầu của nến 15 phút. Đây là khóa thời gian chính của từng dòng quan sát.
*   **close_time**: Thời điểm kết thúc của nến 15 phút. Cột này mang tính thông tin kỹ thuật của raw kline, không khuyến khích dùng làm feature huấn luyện.
*   **interval**: Khoảng thời gian của nến. Trong dataset hiện tại giá trị này là `15m`.

## 2. Cột giá và thanh khoản gốc từ raw kline

*   **open**: Giá mở cửa của nến 15 phút.
*   **high**: Giá cao nhất trong nến 15 phút.
*   **low**: Giá thấp nhất trong nến 15 phút.
*   **close**: Giá đóng cửa của nến 15 phút. Đây là biến giá trung tâm và là cơ sở để tính phần lớn feature cũng như target.
*   **volume**: Khối lượng giao dịch theo đơn vị base asset trong nến 15 phút.
*   **quote_volume**: Giá trị giao dịch theo đơn vị quote asset trong nến 15 phút (với cặp USDT, đây là giá trị tính bằng USDT).
*   **trade_count**: Số lượng giao dịch phát sinh trong nến 15 phút.
*   **taker_buy_base_volume**: Khối lượng mua chủ động theo base asset trong nến 15 phút.
*   **taker_buy_quote_volume**: Giá trị mua chủ động theo quote asset trong nến 15 phút.

## 3. Cột đặc trưng cơ sở của asset (Base Features)

*   **ret_1**: Lợi suất đơn giản trong 1 bước (15 phút):
    $$ret\_1 = \frac{P_t}{P_{t-1}} - 1$$
*   **log_ret_1**: Lợi suất log trong 1 bước:
    $$log\_ret\_1 = \ln(P_t) - \ln(P_{t-1})$$
*   **hl_range_1**: Biên độ dao động nội nến (High-Low Range):
    $$hl\_range\_1 = \frac{high - low}{close}$$
*   **oc_return_1**: Lợi suất từ giá mở cửa đến giá đóng cửa (Open-to-Close):
    $$oc\_return\_1 = \frac{close - open}{open}$$
*   **upper_shadow_1**: Độ dài bóng nến trên đã chuẩn hóa theo giá mở cửa. Phản ánh áp lực bán hoặc từ chối vùng giá cao.
*   **lower_shadow_1**: Độ dài bóng nến dưới đã chuẩn hóa theo giá mở cửa. Phản ánh áp lực mua hoặc từ chối vùng giá thấp.
*   **quote_volume_per_trade_1**: Giá trị giao dịch trung bình trên mỗi giao dịch:
    $$\frac{quote\_volume}{trade\_count}$$
*   **taker_buy_quote_ratio_1**: Tỷ lệ giá trị mua chủ động trên tổng giá trị giao dịch:
    $$\frac{taker\_buy\_quote\_volume}{quote\_volume}$$
*   **taker_buy_base_ratio_1**: Tỷ lệ khối lượng mua chủ động trên tổng khối lượng giao dịch:
    $$\frac{taker\_buy\_base\_volume}{volume}$$
*   **hour_of_day**: Giờ trong ngày tại thời điểm `open_time`.
*   **day_of_week**: Thứ trong tuần tại thời điểm `open_time` (0-6).
*   **day_of_month**: Ngày trong tháng tại thời điểm `open_time`.
*   **is_weekend**: Biến nhị phân (1 nếu là cuối tuần, 0 nếu không).

## 4. Cột đặc trưng trễ và rolling (Lag & Rolling Features)

Các cột này tuân theo logic chung với các cửa sổ thời gian khác nhau ($w \in \{4, 8, 16, 32, 64\}$ và $k \in \{1, 2, 4, 8, 16, 32, 64\}$).

*   **ret_lag_k**: Lợi suất 1 bước tại thời điểm trễ $k$ bước.
*   **log_ret_lag_k**: Lợi suất log tại thời điểm trễ $k$ bước.
*   **price_chg_lag_k**: Tỷ lệ thay đổi giá so với $k$ bước trước: $\frac{P_t}{P_{t-k}} - 1$.
*   **mom_w**: Momentum giá trong cửa sổ $w$ bước: $\frac{P_t}{P_{t-w}} - 1$.
*   **ret_sum_w**: Tổng lợi suất đơn giản `ret_1` trong $w$ bước gần nhất.
*   **log_ret_sum_w**: Tổng log return trong $w$ bước gần nhất.
*   **vol_w**: Độ lệch chuẩn rolling của `ret_1` trong $w$ bước gần nhất (Biến động lịch sử).
*   **realized_vol_w**: Biến động hiện thực hóa (căn bậc hai của tổng bình phương log return).
*   **quote_volume_z_w**: Z-score của `quote_volume` trong cửa sổ $w$ bước.
*   **trade_count_z_w**: Z-score của `trade_count` trong cửa sổ $w$ bước.

## 5. Cột benchmark theo từng symbol

Thông tin từ các tài sản benchmark (thường là BTCUSDT và ETHUSDT):

*   **close_<BENCHMARK_SYMBOL>**: Giá đóng cửa benchmark.
*   **bench_ret_1_<BENCHMARK_SYMBOL>**: Lợi suất 1 bước của benchmark.
*   **bench_log_ret_1_<BENCHMARK_SYMBOL>**: Log return 1 bước của benchmark.
*   **bench_ret_lag_k_<BENCHMARK_SYMBOL>**: Lợi suất benchmark trễ $k$ bước.
*   **bench_mom_w_<BENCHMARK_SYMBOL>**: Momentum benchmark cửa sổ $w$.
*   **bench_ret_sum_w_<BENCHMARK_SYMBOL>**: Tổng lợi suất benchmark cửa sổ $w$.
*   **bench_vol_w_<BENCHMARK_SYMBOL>**: Độ biến động rolling benchmark cửa sổ $w$.

## 6. Cột market-level aggregate từ benchmark

Các biến tổng hợp trạng thái thị trường chung:

*   **market_close_mean**: Giá đóng cửa trung bình của các benchmark.
*   **market_ret_1_mean**: Lợi suất 1 bước trung bình (đại diện chuyển động thị trường ngắn hạn).
*   **market_log_ret_1_mean**: Log return 1 bước trung bình.
*   **market_mom_w**: Momentum trung bình thị trường cửa sổ $w$.
*   **market_vol_w**: Biến động rolling thị trường cửa sổ $w$.

## 7. Cột benchmark cross-sectional summary và relative features

*   **bench_ret_1_mean_cross**: Trung bình mặt cắt ngang của `bench_ret_1`.
*   **bench_mom_16_mean_cross**: Trung bình momentum 16 bước của các benchmark.
*   **bench_vol_16_mean_cross**: Trung bình biến động 16 bước của các benchmark.
*   **rel_ret_vs_benchmark_1**: Lợi suất tương đối của asset so với benchmark: `ret_1 - bench_ret_1_mean_cross`.
*   **rel_mom_vs_benchmark_16**: Momentum tương đối so với benchmark: `mom_16 - bench_mom_16_mean_cross`.

## 8. Cột target dùng cho supervised learning

> [!WARNING]
> Các biến này chứa thông tin tương lai, KHÔNG được dùng làm feature khi huấn luyện mô hình.

*   **target_ret_h**: Lợi suất đơn giản sau $h$ bước: $\frac{P_{t+h}}{P_t} - 1$. (Các horizon: 1, 4, 16, 96 bước).
*   **target_log_ret_h**: Log return tương lai sau $h$ bước: $\ln(\frac{P_{t+h}}{P_t})$.

## 9. Cột cờ chất lượng dữ liệu (Flags)

*   **enough_history_flag**: Bằng 1 nếu đủ lịch sử để tính các feature rolling/lag.
*   **enough_future_flag_96**: Bằng 1 nếu đủ dữ liệu tương lai để tính `target_ret_96`.
*   **is_train_row_24h**: Bằng 1 khi cả hai cờ trên đều bằng 1, đánh dấu dòng dữ liệu hợp lệ để huấn luyện dự báo 24 giờ.

## 10. Quy ước đặt tên (Naming Convention)

| Tiền tố/Hậu tố | Ý nghĩa |
| :--- | :--- |
| `ret_*` | Lợi suất đơn giản |
| `log_ret_*` | Lợi suất log |
| `mom_*` | Momentum giá |
| `vol_*` | Độ biến động rolling |
| `*_lag_*` | Biến trễ |
| `*_sum_*` | Tổng tích lũy |
| `*_z_*` | Z-score (thường là volume/trade count) |
| `bench_*` | Đặc trưng benchmark riêng lẻ |
| `market_*` | Đặc trưng thị trường tổng hợp |
| `rel_*` | Đặc trưng tương đối so với benchmark |
| `target_*` | Biến mục tiêu dự báo |
| `*_flag` | Biến cờ kiểm soát dữ liệu |

---

**Kết luận**: Dataset được tổ chức dưới dạng panel $(symbol, open\_time)$, cho phép mô hình học đồng thời động lực riêng của từng tài sản và trạng thái chung của thị trường qua hệ thống biến phong phú từ cơ bản đến nâng cao.
