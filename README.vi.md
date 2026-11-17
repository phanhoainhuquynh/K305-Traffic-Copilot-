# K305 Traffic Copilot

Ứng dụng nghiên cứu chạy cục bộ cho giao lộ K305. Nếu file dữ liệu nghiên cứu có sẵn ở thư mục cha, ứng dụng đọc 3.000 khung hình và 997 ID; repo cũng có bộ dữ liệu demo tổng hợp để chạy sau khi clone. Python 3.10+; không cần cài thư viện bên ngoài. Giao diện HTML/CSS/JavaScript không phụ thuộc CDN.

## Chạy

Nhấp đúp `start.cmd`. Ứng dụng chạy ở http://127.0.0.1:8766 và mở trình duyệt. Launcher chạy máy chủ nền, lưu PID trong `.server.pid` và log trong `server.log`, `server-error.log`.

Hoặc chạy trong terminal tại thư mục này:

```powershell
python server.py
```

Dùng Ctrl+C để dừng máy chủ chạy trong terminal. Với máy chủ nền, xem PID trong `.server.pid`, kiểm tra đúng tiến trình Python của ứng dụng trong Task Manager rồi kết thúc tiến trình đó. Máy chủ chỉ lắng nghe loopback, không mở ra mạng LAN.

Nếu có file `../k305_object_list_2026-06-16_07-00_to_07-04.json`, ứng dụng dùng file đó; nếu không, ứng dụng chuyển sang `demo_data.json` (dữ liệu tổng hợp). Không đưa dữ liệu nghiên cứu gốc vào repo. Có thể chỉ định file khác cùng schema bằng `python server.py --data "path/to/file.json" --port 8766`.

## Tính năng

- Google Maps Hybrid tại K305 với lớp đối tượng, tuyến, vệt và dự đoán lấy từ JSON. Tọa độ cảm biến X/Y được chiếu lên bản đồ; có thể đặt gốc bằng cách nhấp tâm giao lộ và căn góc trục +X. Cuộn bản đồ để zoom, ↺ để quay lại K305.
- Phát lại theo timestamp, tốc độ 1×/2×/5×; thanh kéo thời gian.
- Chọn ID trên bản đồ/bảng, lọc theo loại, tìm trong toàn bộ 997 ID và chuyển đến lần xuất hiện đầu tiên.
- Chat theo ID hoặc đối tượng đang chọn: loại, tốc độ/vị trí, khoảng thời gian quan sát, kiểm tra làn, dự đoán 3–5 giây, khoảng cách giữa hai ID và tổng quan cảnh. Gửi chat tạm dừng phát lại.
- Ngoại suy vị trí `p(t+h)=p(t)+v(t)*h`. Dự đoán chỉ dùng khung hình hiện tại. Lịch sử và thống kê ID chỉ đọc tới thời điểm đang xem.
- Cảnh báo khoảng cách tâm gần nhất trên các quỹ đạo dự đoán lấy mẫu mỗi 0,5 giây; dùng tuyến đã khớp khi có. Ngưỡng là tổng bán kính vòng tròn bao hộp đối tượng + 0,5 m. Đây là heuristic có thể cảnh báo dư, không phải xác suất va chạm.
- Tám nét chính từ ảnh chú giải được số hóa gần đúng trong `routes.json`; có thể kiểm tra, xóa và vẽ lại bằng công cụ tuyến. Dự đoán tương lai bám tuyến gần nhất nếu xe cách tối đa 4,5 m, lệch hướng tối đa 65° và đang chạy từ 0,5 m/s. Nếu không có tuyến phù hợp, quay về ngoại suy vận tốc thẳng. Đây là heuristic, không học ý định rẽ; replay lịch sử luôn giữ nguyên tọa độ JSON.
- Vẽ/nhập/xuất bản đồ làn; lưu bền vững trong `lanes.json`. Xác nhận cùng hệ tọa độ trước khi bật đánh giá. Kiểm tra tâm trong đa giác, loại được phép và góc giữa vận tốc với chiều làn. Ngoài làn đã khai báo không tự động bị kết luận vi phạm. Vận tốc < 0,5 m/s không được đánh giá hướng; lệch >100° cảnh báo ngược chiều, >45° chưa chắc chắn. Các ngưỡng là quy tắc nghiên cứu có thể điều chỉnh trong `server.py`.
- Xuất JSON cho cảnh hiện tại cùng hội thoại, nguồn và giả định.

## Chat cục bộ và mô hình AI

Mặc định là **bộ phân tích câu hỏi theo quy tắc**, chạy ngay không cần API. Đây không phải LLM; chỉ hỗ trợ các ý định nêu trên. Ví dụ:

- `ID 55177 là car hay bike?`
- `ID 54042 đang đi nhanh bao nhiêu?`
- `Xe này có đi đúng làn không?`
- `ID 54042 đi đâu trong 3 giây?`
- `ID 55177 và 54042 có nguy cơ va chạm trong 5 giây?`
- `Tổng quan giao thông hiện tại`

Tích hợp OpenAI Responses API có sẵn nhưng cần khóa và model có quyền truy cập. Trong PowerShell, đặt các biến môi trường ở chính terminal sẽ khởi động máy chủ:

```powershell
$env:OPENAI_API_KEY = 'YOUR_API_KEY'
$env:OPENAI_MODEL = 'YOUR_ACCESSIBLE_MODEL_ID'
python server.py --port 8766
```

Mở http://127.0.0.1:8766 rồi bật **AI API** trong khung chat. Không lưu khóa vào mã nguồn. Nếu máy chủ cũ còn chạy, cần khởi động lại hoặc dùng cổng mới. Model được cấu hình thay vì cố định vào một tên có thể không có trên tài khoản của bạn.

Khi bật AI API, câu hỏi, thống kê ID liên quan và dữ liệu cảnh hiện tại được gửi tới OpenAI để diễn giải. Chế độ mặc định không gửi dữ liệu ra ngoài. Khóa chỉ được sử dụng trên máy chủ. Yêu cầu API đặt `store: false`; đây không phải cam kết zero data retention. Lỗi/timeout sẽ được hiển thị và trả kết quả cục bộ thay thế.

Tham khảo triển khai: [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses). Tích hợp API được kiểm tra cấu trúc và đường lỗi bằng mock; chưa gọi dịch vụ thật vì chưa cấu hình khóa/model trong lần xây dựng này.

## Bản đồ làn

Không có bản đồ làn trong dữ liệu nguồn; mặc định hệ thống trả **chưa đủ dữ liệu**. Không suy diễn làn hợp pháp chỉ từ quỹ đạo. Dùng nút Thiết lập làn, vẽ đa giác trên bản đồ hoặc nhập cấu trúc sau (ví dụ hình học minh họa, không phải làn K305 thật):

### Google Maps và hiệu chỉnh tọa độ

Giao diện không còn dùng ảnh chụp làm nền. Google Maps JavaScript API cần một API key có bật Maps JavaScript API và billing. Tạo key trong Google Cloud, giới hạn key cho Maps JavaScript API và HTTP referrer cục bộ như `http://127.0.0.1:8766/*` (thêm `http://localhost:8766/*` nếu cần). Không gửi hoặc lưu key trong source code.

Trong PowerShell, đặt key rồi khởi động máy chủ trong chính cửa sổ đó:

```powershell
$env:GOOGLE_MAPS_API_KEY = 'YOUR_RESTRICTED_GOOGLE_MAPS_KEY'
python server.py --port 8766
```

Nếu cổng 8766 đang chạy phiên bản cũ, dừng đúng tiến trình Traffic Copilot trước khi khởi động lại. Khi chưa có key, lớp tọa độ, đối tượng và tuyến vẫn dùng được; nền Google hiển thị qua liên kết K305 riêng.

File JSON không có GPS hoặc phép biến đổi từ hệ trục cảm biến sang vĩ độ/kinh độ. Tâm K305 từ liên kết Google Maps là vị trí ban đầu ước lượng; nhấn “Đặt gốc X/Y” rồi nhấp vào vị trí tương ứng với (0,0), sau đó điều chỉnh góc +X để tuyến trùng với đường thực. Tọa độ và hướng được giả định tính bằng mét và độ; overlay chưa phải hiệu chuẩn khảo sát. Cần hiệu chỉnh và kiểm tra các tuyến/làn trên bản đồ trước khi dùng để kết luận.

```json
{
  "verified": false,
  "lanes": [{
    "id": "Example only",
    "polygon": [[0,0],[20,0],[20,4],[0,4]],
    "heading": 0,
    "allowed": ["Car","Van","Truck","Bus","Motorcycle"]
  }]
}
```

Góc ngược chiều kim đồng hồ từ +X; +Y=90°. Kiểm tra với bản đồ thực và phép chuyển đổi tọa độ trước khi xác nhận. Cấu hình nhập qua giao diện luôn quay về trạng thái chưa xác nhận.

## Giới hạn hiện tại

Đây là MVP xử lý **object list đã nhận diện/tracking**, chưa có mô hình nhận diện video/point cloud thô hay kết nối cảm biến trực tiếp. Nhãn car/bike/pedestrian lấy từ `class_name`; score nguồn không được diễn giải thành độ chính xác.

Nguồn chưa ghi đơn vị: vị trí m và vận tốc m/s là **giả định cần xác minh**. Kiểm tra làn chưa xét toàn bộ thân xe hay luật, đèn và biển báo. Dự đoán chưa học ý định rẽ, tăng/giảm tốc hoặc tương tác; không có xác suất hiệu chuẩn. Thống kê nhãn ID chỉ dựa trên quan sát đến thời điểm hiện tại; ID có thể sai/đổi do tracker nguồn.

## Kiểm tra

```powershell
python -m unittest -v
node --check static/app.js
python evaluate.py
```

`evaluation.json` chứa sai số vị trí cuối sau 3/5 giây trên bản ghi thật, lấy mẫu mỗi 10 khung hình và chỉ xét ID xuất hiện liên tục. So sánh với đầu ra tracker, không phải ground truth độc lập; có thiên lệch do chỉ lấy đối tượng còn quan sát được. Không dùng dữ liệu đánh giá tương lai trong API dự đoán.

API: `GET /api/meta`, `GET /api/frame?index=0&horizon=5`, `GET /api/track?id=55177&index=0`, `GET/POST /api/lanes`, `GET/POST /api/routes`, `POST /api/chat`. Không có framework hoặc database bắt buộc; dữ liệu và cấu hình là file JSON.


## Ngôn ngữ / Languages / Sprachen

Chọn **Tiếng Việt / English / Deutsch** ở góc trên. Lựa chọn được lưu trong trình duyệt; đổi ngôn ngữ không đặt lại thời điểm, ID đang chọn hoặc bản nháp làn. Các tin nhắn đã gửi giữ nguyên ngôn ngữ; câu trả lời mới theo ngôn ngữ đang chọn. Giao diện, hướng dẫn, thông báo và chatbot cục bộ đều hỗ trợ ba ngôn ngữ. Chế độ AI cũng nhận yêu cầu trả lời theo lựa chọn này.

Examples: `Where will ID 54042 be in 3 seconds?`, `Is ID 55177 in the correct lane?`.

Beispiele: `Wo ist ID 54042 in 3 Sekunden?`, `Fährt ID 55177 auf der richtigen Spur?`, `Wie lange wurde ID 54042 beobachtet?`.

Translations are maintained in `static/locales.json`, shared by the UI and the local response formatter in `localization.py`. IDs, sensor coordinates, lane names and source class identifiers remain unchanged.
