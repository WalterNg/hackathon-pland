# Chương 2: Kiến thức nghiệp vụ & Kinh tế (Business & Economic Knowledge)

Chương này mô tả cách PLAND chuyển hóa các quy tắc tài chính và tiêu chuẩn quản trị rủi ro chuyên sâu thành logic vận hành cốt lõi của hệ thống. Bằng cách tích hợp nghiệp vụ vào cả hạ tầng xử lý dữ liệu Backend và quy trình suy luận đa tầng (Multi-Agent Reasoning), PLAND đảm bảo mọi khuyến nghị đầu tư không chỉ dựa trên dữ liệu thuần túy mà còn tuân thủ nghiêm ngặt các nguyên tắc kinh tế và kỷ luật thị trường.

## 2.1 Phân tích Kỹ thuật & Chỉ số (Technical Indicators)

Hệ thống PLAND sử dụng các chỉ báo kỹ thuật tiêu chuẩn để định lượng sức mạnh xu hướng và động lượng của tài sản.

### 2.1.1 Các chỉ báo cốt lõi

- **Chỉ số sức mạnh tương đối (RSI - Relative Strength Index)**
  - **Định nghĩa**: RSI là một chỉ báo động lượng (momentum) đo lường tốc độ và sự thay đổi của các biến động giá. Đây là một trong những công cụ phổ biến nhất để xác định liệu một tài sản đang ở trạng thái "quá mua" (Overbought - giá tăng quá nhanh và có xu hướng điều chỉnh) hay "quá bán" (Oversold - giá giảm quá sâu và có xu hướng phục hồi).
  - **Công thức**:
    $$RSI = 100 - \frac{100}{1 + RS}$$
    $$RS = \frac{\text{Average Gain}}{\text{Average Loss}}$$
    Trong đó, $RS$ (Relative Strength) được tính bằng tỷ lệ giữa giá trị tăng trung bình và giá trị giảm trung bình trong $n$ phiên giao dịch (PLAND sử dụng mặc định $n=14$).
  - **Ý nghĩa & Ứng dụng trong PLAND**:
    - **Cơ chế xác định xu hướng**: PLAND sử dụng RSI làm "bộ lọc" động lượng. Cụ thể, `RSI >= 55` là điều kiện bắt buộc để hệ thống dán nhãn **Bullish** cho tài sản, và `RSI <= 45` cho nhãn **Bearish**.
    - **Vùng Lưỡng lự (Neutral Zone)**: Khoảng giá trị từ **45 đến 55** được coi là vùng không rõ xu hướng (No-man's land). Khi RSI nằm trong dải này, hệ thống đánh giá rằng lực mua và lực bán đang ở trạng thái cân bằng hoặc thị trường đang tích lũy, do đó sẽ ưu tiên nhãn **Neutral** để tránh các quyết định giao dịch rủi ro trong vùng nhiễu.
    - **Trọng số tín hiệu**: Hệ thống tự động cộng thêm **1 điểm thưởng** vào chỉ số sức mạnh tín hiệu (Signal Strength) nếu RSI tiến vào các vùng cực đoan ($>= 65$ hoặc $<= 35$), giúp người dùng nhận diện các cơ hội đảo chiều hoặc củng cố xu hướng hiện tại.

- **Đường Trung bình động (Moving Average - MA)**
  - **Định nghĩa**: MA là chỉ báo giúp làm mượt dữ liệu giá bằng cách tính trung bình cộng trong một khoảng thời gian nhất định, từ đó loại bỏ các "nhiễu" thị trường và làm lộ rõ xu hướng chủ đạo. Hệ thống sử dụng cả **SMA** (Trung bình đơn giản) cho xu hướng dài hạn và **EMA** (Trung bình lũy thừa) để phản ứng nhanh hơn với các biến động giá gần nhất.
  - **Công thức**:
    - **SMA (Simple Moving Average)**:
      $$SMA = \frac{P_1 + P_2 + \dots + P_n}{n}$$
      Trong đó: $P_i$ là giá đóng cửa của phiên thứ $i$, $n$ là số phiên tính trung bình.
    - **EMA (Exponential Moving Average)**:
      $$EMA_{\text{hôm nay}} = Price_{\text{hôm nay}} \times K + EMA_{\text{hôm qua}} \times (1 - K)$$
      Trong đó: $K = \frac{2}{n + 1}$ là hệ số nhân làm mượt (Smoothing constant). 
      *Lưu ý: EMA ưu tiên trọng số cho giá gần nhất, giúp PLAND phản ứng nhanh hơn với các cú sốc giá ngắn hạn.*
  - **Ý nghĩa & Ứng dụng trong PLAND**:
    - **Mỏ neo trung tâm**: PLAND lấy đường **MA50** làm mốc tham chiếu quan trọng. Khoảng cách giữa giá hiện tại và MA50 (MA50 Gap) là biến số quan trọng nhất để phân loại trạng thái danh mục.
    - **Đo lường độ lệch**: Nếu giá cao hơn MA50 trên 1%, hệ thống ghi nhận trạng thái tích cực. Ngược lại, nếu thấp hơn MA50 trên 1%, hệ thống sẽ kích hoạt cảnh báo rủi ro về mặt kỹ thuật.

- **Chỉ báo Phân kỳ hội tụ trung bình động (MACD)**
  - **Định nghĩa**: MACD là một chỉ báo động lượng theo xu hướng, cho thấy mối quan hệ giữa hai đường trung bình động (thường là EMA 12 và EMA 26). Nó giúp nhà đầu tư nắm bắt được sức mạnh của xu hướng và thời điểm tiềm năng mà xu hướng đó có thể thay đổi.
  - **Công thức**:
    - **MACD Line (Đường MACD)**:
      $$MACD = EMA(12) - EMA(26)$$
    - **Signal Line (Đường Tín hiệu)**:
      $$Signal = EMA(MACD, 9)$$
    - **MACD Histogram**:
      $$Histogram = MACD - Signal$$
    - *Trong đó: EMA(12) và EMA(26) là các đường trung bình động lũy thừa chu kỳ 12 và 26. Sự hội tụ và phân kỳ giữa các đường này báo hiệu sự thay đổi trong cấu trúc giá.*
  - **Ý nghĩa & Ứng dụng trong PLAND**:
    - **Xác nhận đảo chiều**: Các Agent AI trong PLAND sử dụng sự giao cắt giữa đường MACD và đường Tín hiệu (Signal Line) để xác nhận các điểm đảo chiều tiềm năng sau khi đã được lọc qua các bộ chỉ số khác.
    - **Đo lường động lượng**: Histogram được sử dụng để trực quan hóa việc động lượng đang mạnh lên hay yếu đi, hỗ trợ lớp AI đưa ra các nhận định Bull/Bear sâu sắc hơn.

- **Dải băng Bollinger (Bollinger Bands)**
  - **Định nghĩa**: Là công cụ kết hợp giữa đường trung bình động và độ lệch chuẩn để đo lường mức độ biến động của thị trường. Cấu tạo gồm dải giữa (thường là SMA 20) và hai dải biên (trên và dưới).
  - **Công thức**:
    - **Dải giữa**: $SMA(20)$.
    - **Dải trên/dưới**: $SMA(20) \pm (2 \times \text{Độ lệch chuẩn})$.
  - **Ý nghĩa & Ứng dụng trong PLAND**:
    - **Đo lường rủi ro biến động (Volatility Risk)**: Khi dải băng co hẹp lại (Squeeze), hệ thống sẽ cảnh báo về một đợt bùng nổ biến động giá sắp diễn ra.
    - **Xác định vùng cực đoan**: Vị trí của giá so với dải biên được ghi nhận vào Snapshot kỹ thuật để AI đánh giá xem tài sản có đang bị đẩy đi quá xa khỏi giá trị trung bình hay không, từ đó đưa ra khuyến nghị Hold/Sell phù hợp.

### 2.1.2 Thuật toán Phân loại Xu hướng (Heuristic Trend Classification)

Backend của PLAND kết hợp các chỉ số trên thành một logic phân loại duy nhất để tối ưu hóa việc ra quyết định cho AI:

- **Bullish (Tích cực):** Giá cao hơn MA50 ít nhất 1% (`GAP_MA50 > 1%`) **VÀ** `RSI >= 55` **VÀ** `RVOL >= 1`.
- **Bearish (Tiêu cực):** Giá thấp hơn MA50 ít nhất 1% (`GAP_MA50 < -1%`) **VÀ** `RSI <= 45`.
- **Neutral (Trung lập):** Trạng thái được kích hoạt khi:
    - RSI nằm trong vùng lưỡng lự (**45 đến 55**).
    - Hoặc giá đang dao động quá gần đường MA50 (biên độ dưới 1%).
    - Hoặc các chỉ số kỹ thuật đang có sự xung đột (ví dụ: Giá trên MA50 nhưng RSI vẫn dưới 55 hoặc RVOL thấp). Logic này giúp loại bỏ các tín hiệu "nhiễu" và bảo vệ nhà đầu tư khỏi các đợt bùng nổ giả (Fakeout).

### 2.1.3 Thuật toán Chấm điểm Tín hiệu (Signal Strength)

Hệ thống tính toán điểm số từ **1 đến 10** để đo lường độ tin cậy của xu hướng:

- **Điểm gốc:** 5.
- **Biên độ MA50:** Cộng tối đa 2 điểm dựa trên khoảng cách giá so với MA50 (`abs(GAP_MA50) / 3`).
- **Khối lượng (RVOL):** Cộng 1 điểm nếu `RVOL >= 1.5` (có sự đồng thuận của dòng tiền).
- **Động lượng (RSI):** Cộng 1 điểm nếu RSI ở vùng cực đoan (`>= 65` hoặc `<= 35`).

## 2.2 Tâm lý Thị trường & Tranh luận Chiến lược (Sentiment & Investment Debate)

Khác với các hệ thống AI thông thường chỉ đưa ra một nhận định duy nhất, PLAND áp dụng mô hình **Tranh luận đối lập (Multi-Agent Debate)** để loại bỏ thiên kiến xác nhận (Confirmation Bias):

- **Bull vs. Bear Researcher**: Hệ thống kích hoạt đồng thời hai Agent đóng vai trò đối nghịch:
    - **Bull Researcher (Phe Bò)**: Tìm kiếm các lý lẽ tích cực, cơ hội tăng trưởng và các dấu hiệu củng cố xu hướng tăng.
    - **Bear Researcher (Phe Gấu)**: Tìm kiếm các rủi ro tiềm ẩn, dấu hiệu suy yếu và các lý lẽ cho sự sụt giảm.
- **Cơ chế Phản biện (Rebuttal)**: Các Agent này không chỉ đưa ra ý kiến riêng lẻ mà còn tranh luận trực tiếp với nhau thông qua **Conversation Memory**. Sự va chạm giữa hai luồng tư tưởng giúp người dùng nhìn nhận tài sản một cách khách quan nhất trước khi đưa ra quyết định.
- **Fear & Greed Index & Narrative**: Kết quả tranh luận được kết hợp với dữ liệu tâm lý thị trường diện rộng để xác định bối cảnh đầu tư hiện tại.

## 2.3 Quản trị Rủi ro & Đa góc nhìn (Multi-Perspective Risk Assessment)

Quản trị rủi ro trong PLAND không chỉ là các con số cứng nhắc mà là một quy trình đánh giá đa chiều từ 3 trường phái đầu tư:

- **Hội đồng Rủi ro**: 
    - **Aggressive (Tấn công)**: Chấp nhận rủi ro cao hơn để đổi lấy lợi nhuận, ưu tiên các tài sản có động lượng mạnh.
    - **Conservative (Phòng thủ)**: Ưu tiên bảo toàn vốn, cực kỳ khắt khe với các dấu hiệu suy yếu.
    - **Neutral (Trung lập)**: Tìm kiếm sự cân bằng và ổn định.
- **Risk Judge (Thẩm phán rủi ro)**: Sau khi các trường phái tranh luận, Agent này sẽ đóng vai trò trọng tài để đưa ra điểm số rủi ro cuối cùng dựa trên sự đồng thuận và các bằng chứng thuyết phục nhất.
- **Các chỉ số bảo vệ định lượng**: 
    - **Cash Ratio**: Đảm bảo thanh khoản và sức mua dự phòng.
    - **Concentration Score**: Đo lường sự phụ thuộc vào các tài sản đơn lẻ.
    - **Guardrails (Rào chắn an toàn)**: Lớp kiểm soát cuối cùng đảm bảo mọi quyết định thực thi đều nằm trong giới hạn an toàn tuyệt đối của tài khoản.


## 2.4 Đánh giá trạng thái hệ thống (Market Regime)

PLAND sử dụng hai chỉ số chính để xác định tâm thế đầu tư:

- **Market Regime:**
  - **Risk-on:** Khi `Bullish_Weight >= 60%` VÀ `Weighted_Avg_RSI >= 55`. Hệ thống khuyến khích nắm giữ hoặc gia tăng vị thế.
  - **Risk-off:** Khi `Bearish_Weight >= 40%` HOẶC `Weighted_Avg_RSI <= 45`. Hệ thống chuyển sang chế độ phòng thủ, ưu tiên bảo toàn vốn.
- **Technical Breadth (Độ rộng kỹ thuật):**
  - **Broadly Bullish:** Khi `Bullish_Weight >= 65%` (Đa số tài sản đồng thuận tăng).
  - **Weak:** Khi `Bearish_Weight >= 45%` (Thị trường đang suy yếu diện rộng).

---

_Các công thức và logic nghiệp vụ trên được mã hóa trực tiếp vào lõi xử lý dữ liệu của PLAND, tạo thành "bộ khung kỷ luật" cho mọi khuyến nghị của trí tuệ nhân tạo._
