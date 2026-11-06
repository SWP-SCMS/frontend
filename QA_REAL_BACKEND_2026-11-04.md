# Kiểm thử FE với BE local thật — 04/11/2026

## Môi trường và phạm vi

- FE: `http://localhost:5175`, branch `fix/ui-qa-polish`, nền commit `e02e2aa` cùng thay đổi polling/navigation chưa commit.
- API thật: `http://localhost:8080/api/v1`. BE checkout `09215bd` trên `main`; không sửa code BE. SHA của tiến trình BE đang chạy chưa có endpoint xác minh riêng.
- Chrome/Playwright dùng đăng nhập thật, request/response thật, đồng hồ thật. Không mock API, không sửa DB trực tiếp, không giả lập đồng hồ trong các ca dưới đây.
- Tiền mặt và đối soát là giao dịch QA trong hệ thống, không chuyển tiền ngân hàng thật.
- **11 ca tự động đạt** (7 Course/Audit + 4 Training/navigation), thêm kiểm tra lịch công khai bằng Chrome DevTools MCP. Không có HTTP >= 400 hoặc lỗi JavaScript trong hai lượt hoàn tất.

## Kết quả

| Ca | Kết quả / bằng chứng |
|---|---|
| Danh mục Course tự cập nhật | Manager thay tên qua API thật, trang danh mục đang mở nhận tên mới; modal tạo Course và tên nháp chưa lưu không bị mất, không navigation/reload. |
| Audit History | Mutation Manager sinh audit thật; bảng tự nhận thay đổi, giữ bộ lọc chưa áp dụng và không reload. |
| Member tạo đơn và QR | UI tạo order trả 201; tạo payment trả 200, QR hiện trên màn hình. |
| Manager đối soát → Member | Đối soát qua UI; Member tự hiện đã xác nhận, có enrollment ACTIVE. Khoảng 10,4 giây từ thao tác xác nhận đến assertion; không reload Member. |
| Reception thu tiền mặt → Member | API trả CourseEnrollmentResponse thật; UI báo đã thanh toán, ẩn nút thu tiền lần nữa. Đúng một POST cash; Member tự cập nhật. |
| Chờ rút / hủy → roster HLV | API gửi rút làm learningSuspended=true; modal roster đang mở tự bỏ Member. Hủy yêu cầu thì Member tự xuất hiện lại; Member khác vẫn hiển thị. |
| Duyệt rút → sĩ số | Report thật: ban đầu 2 ACTIVE; chờ rút có 1 ACTIVE + 1 PENDING; duyệt xong 1 ACTIVE + 1 WITHDRAWN. Roster không còn Member đã rút. |
| HLV tạo giáo án → Member | HLV 0804040404 tạo giáo án QA qua UI cho MB-100024. Member thấy dữ liệu mới sau khoảng 4,9 giây tính từ response, không reload. |
| HLV cập nhật giáo án → Member | UI PUT tạo version 2; Member nhận tên/phiên bản mới sau khoảng 5,5 giây. Phiên bản 1 đang mở giữ nguyên; mở version 2 thấy nội dung mới. |
| Lưu trữ giáo án | Archive qua API thật; Member tự hiện trạng thái đã lưu trữ, không reload. |
| Navigation và học bù | Khám phá khóa học giữ layout Member. Run QA có 3 bản ghi gốc/bù nhưng trang đăng ký chỉ hiện 2 buổi hiệu lực. Chrome MCP xác minh trang Run công khai cũng hiện đúng 2 buổi. |

Thiết lập fixture, cập nhật đối ứng cho catalog/audit và gửi/duyệt/hủy yêu cầu rút dùng API xác thực. Tạo order/QR, đối soát, thu tiền mặt, tạo/sửa giáo án đi qua UI thật. Đây không phải kiểm thử mọi bước nghiệp vụ qua UI.

Polling nghỉ 7 giây **sau khi batch trước hoàn tất**. Độ trễ thực tế gồm thời gian API/render và thời điểm thay đổi; không cam kết mọi cập nhật xuất hiện trong đúng 7 giây.

Catalog không trả `availableSlots`. Ca sĩ số kiểm report enrollment thật; chưa chứng minh trực tiếp việc nhận thêm một người mới vào chỗ vừa trả.

## Fixture và bằng chứng local

- Lượt Course đạt: `QA-POLL-1793735922632`, 2 suất/2 buổi; MB-100019 đã được duyệt rút; MB-100024 thanh toán tiền mặt QA và còn ACTIVE. Giá mỗi đơn 1.000 VND.
- Lượt đầu: `QA-POLL-1793735748565`; giữ để đối chiếu. Có đơn QA chưa thu tiền mặt; không xóa lịch sử hoặc sửa DB trực tiếp.
- Giáo án `QA-TRAINING-1793736170015 updated` đã lưu trữ sau kiểm thử. Không thay thế giáo án ACTIVE có sẵn.
- `test-results/live-be-report.json`: kết quả Course cuối, method/path/status, IDs fixture. Mục kiểm điều kiện tài khoản giáo án không tính là ca chức năng đạt; sau đó đã dùng tài khoản HLV bổ sung để kiểm thật.
- `test-results/live-training-report.json`: kết quả giáo án, navigation, lịch hiệu lực.
- `test-results/live-be-first-attempt.json`: lượt đầu lỗi script kiểm thử (timeout 5 giây quá ngắn, chọn phân trang HLV trước khi tải xong, giả định catalog có availableSlots). Đã chỉnh script theo contract và chạy lại; không coi các lỗi này là lỗi sản phẩm.
- Report không lưu token/password/login response. Thư mục test-results bị Git ignore và có thể bị lần chạy test khác ghi đè.

## Chưa kiểm trong lượt này

- Cash POST thành công nhưng GET sau đó lỗi; retry sau mất response. Lượt này kiểm đường thành công với BE thật.
- Chuyển khoản thật/webhook, chuyển tiền trễ, đối soát khoản hết hạn.
- Điểm danh đúng giờ; ngưỡng 7/10 → 6/10; duyệt rút trễ; tự kết thúc Run; chi hoàn thường sau kết thúc.
- Waitlist nhận chỗ vừa giải phóng, transfer/refund đầy đủ, race/concurrent requests.
- Toàn bộ gym/PT/membership/room/leave và mọi trang chi tiết/form. Không suy từ các ca trên rằng toàn bộ dự án đã được nghiệm thu.
- Bộ Docker runtime mới ghim BE `12fa1df` chưa chạy; kết quả trên dùng server local đang hoạt động.

Không sửa code sản phẩm, không commit/push trong lượt này. Báo cáo giữ local ngoài commit.
