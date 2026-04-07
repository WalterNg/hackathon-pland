# Chương 5: Phân tích Use-case (Use-case Analysis)

PLAND mang lại giá trị khác nhau cho từng nhóm đối tượng người dùng. Dưới đây là 2 kịch bản thực tế minh họa khả năng của hệ thống Multi-Agent.

## 5.1 Use-case 1: Trader mới (Alex) - Vai trò của Risk Agent
**Alex** là một nhà đầu tư mới tham gia thị trường. Anh thường bị ảnh hưởng bởi tâm lý đám đông (FOMO) khi thấy thị trường xanh rực.

*   **Bối cảnh:** BTC và các Altcoin đang tăng mạnh. Sentiment Agent báo cáo "Extreme Greed" (85/100).
*   **Hành động:** Alex định bấm "Accumulate" (Mua thêm) để không bỏ lỡ đà tăng.
*   **Xử lý Multi-Agent:**
    *   **TA Agent:** Đồng ý (`Bullish`), tín hiệu mua mạnh.
    *   **Sentiment Agent:** Đồng ý (`Very Bulish`), tin tức tích cực tràn ngập.
    *   **Risk Agent (Người gác cổng):** Nhận thấy tỷ lệ Cash của Alex chỉ còn 5% và danh mục đang quá tập trung. Agent này phán quyết: `risk_level: "Critical"`.
*   **Kết quả:** Hệ thống đưa ra khuyến nghị **"Hold"** kèm cảnh báo: *"Mức độ rủi ro cực cao, dừng mọi hoạt động mua mới để bảo toàn vốn."* Alex nghe theo và tránh được việc đu đỉnh khi thị trường điều chỉnh ngay sau đó.

---

## 5.2 Use-case 2: Trader kinh nghiệm (Sarah) - Vai trò của TA Agent
**Sarah** là một trader chuyên nghiệp, cô sử dụng PLAND để có cái nhìn sâu sắc hơn về cấu trúc thị trường mà không cần ngồi soi chart cả ngày.

*   **Bối cảnh:** Một token trong danh mục của Sarah đang đi ngang (Sideway) sau một đợt tăng dài.
*   **Hành động:** Sarah yêu cầu "Deep Insight" cho token này.
*   **Xử lý Multi-Agent:**
    *   **TA Agent:** Phát hiện **Phân kỳ OBV Bearish** (Giá đi ngang nhưng dòng tiền thoát ra) và **RVOL cao bất thường** ở các nến giảm.
    *   **Sentiment Agent:** Ghi nhận tâm lý đang chuyển dịch sang `Neutral`.
    *   **Risk Agent:** Xác nhận mức rủi ro `Moderate`.
*   **Kết quả:** Hệ thống khuyến nghị **"Take Profit 50%"** kèm luận điểm kỹ thuật chi tiết về dòng tiền suy yếu. Sarah tự tin chốt lời một phần trước khi giá chính thức sập sâu.

## 5.3 Tổng kết giá trị mang lại
| Loại người dùng | Giá trị cốt lõi từ PLAND |
| :--- | :--- |
| **Newbie (Alex)** | Ngăn chặn cảm xúc tiêu cực, bảo vệ vốn bằng các quy tắc rủi ro tự động. |
| **Pro (Sarah)** | Cung cấp các thông tin "Hard Data" (RVOL, OBV, Divergence) vốn khó tự soi bằng mắt trên nhiều tài sản cùng lúc. |
| **Hedge Fund / Team** | Hệ thống hóa quy trình ra quyết định theo mô hình chuyên biệt hóa (Agents coordination). |

---
*Các Use-case trên chứng minh PLAND là người bạn đồng hành tin cậy, giúp người dùng giao dịch có kỷ luật và thông tin.*
