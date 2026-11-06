# FE lịch tuần cho đợt mở khóa học

Ngày kiểm tra: 05/11/2026. FE localhost:5175, BE thật localhost:8080. Không push/merge.

## Thay đổi

- ManagerCourseRunsPage dùng WeeklyCourseRunModal thay form nhập ngày kết thúc thủ công; tải phòng từ API quản lý.
- Chọn khóa đã công bố, HLV, phòng đủ sức chứa, học phí, sĩ số, ngày khai giảng, thứ trong tuần, giờ bắt đầu/kết thúc và tổng buổi.
- courseAdminService gọi POST /manager/course-runs/preview-schedule và /with-schedule.
- Preview tự gọi sau khi lịch hợp lệ, debounce 350 ms, hủy request cũ và bỏ kết quả không khớp lịch hiện tại; có nút thử lại khi tải lỗi. Chỉ lưu khi có preview khớp dữ liệu.
- BE trả ngày kết thúc và danh sách buổi; FE không tự quyết định ngày kết thúc. Thứ 2–4–6 gửi ISO weekdays [1,3,5], thời gian đăng ký gửi ISO theo UTC+7.
- Khi lưu khóa form chống gửi lặp; thành công mở trang chi tiết với lịch đã tạo, tiếp tục mở đăng ký bằng luồng cũ.
- courseWeeklySchema chặn ngày không tồn tại, ngày khai giảng không đúng thứ chọn, giờ ngược, số buổi ngoài 1..366, sĩ số tối thiểu vượt sức chứa, học phí không đủ phân bổ và khoảng đăng ký sai.
- Sửa lỗi thông báo validation còn sót sau khi sửa dữ liệu phụ thuộc; không chờ bấm lưu mới xóa lỗi cũ.
- Thêm courseWeekly.test.js kiểm tra hợp đồng payload, múi giờ và các ràng buộc lịch/đăng ký.
- Không sửa BE trong lượt nối FE này. BE đã có API mới từ lượt trước; xem backend/docs/COURSE_WEEKLY_SCHEDULE_HANDOFF.md.

## Chrome MCP với BE thật

| Ca kiểm tra | Kết quả |
| --- | --- |
| Mở form từ Quản lý → Khóa học → Đợt mở khóa học | PASS, đủ trường chọn lịch/phòng, không có ngày kết thúc nhập tay |
| Thứ 2–4–6, khai giảng 03/02/2031, 18:00–19:00, 4 buổi | PASS, preview 03/02, 05/02, 07/02, 10/02; kết thúc 19:00 ngày 10/02/2031 |
| Đổi khai giảng sang 04/02/2031 (thứ Ba) | PASS, báo tiếng Việt, bỏ preview cũ, khóa nút tạo |
| Sửa lại 03/02/2031 | PASS, preview trở lại, hết lỗi validation |
| Gửi lịch 04/02/2030 trùng tài nguyên có sẵn | PASS, HTTP 409, thông báo “Phòng hoặc huấn luyện viên đã có lịch vào thời gian này.”, giữ form |
| Tạo lịch hợp lệ năm 2031 qua nút Tạo đợt và lịch học | PASS, HTTP 201, điều hướng tới chi tiết DRAFT, GET lại đủ 4 buổi |
| Phân bổ 1001 VND/4 buổi | PASS, [250,250,250,251] |
| Mở đăng ký bằng UI | PASS, HTTP 200, trạng thái Đang mở đăng ký |
| Trang công khai bằng Chrome context chưa đăng nhập | PASS, đủ 4 buổi, phòng F1-020, HLV Anh Bô Xin, ngày kết thúc và nút Đăng nhập để đăng ký |
| Layout modal ở viewport 1280×762 | PASS, modal/body không tràn ngang, nội dung cuộn dọc |

Network Chrome: preview reqid 1328/1332 = 200; create reqid 1334 = 201; GET run/sessions 1340/1341 = 200; open-registration 1380 = 200. Lỗi console 409 tương ứng ca trùng lịch; context công khai có 401 khi thử refresh phiên chưa đăng nhập, nhưng tải nội dung khóa công khai thành công. Không thấy exception React trong lượt này.

Chrome fill_form có hạn chế với input time; các trường giờ đã được nhập qua DOM input/change bằng Chrome MCP. Tạo đợt và mở đăng ký đều bấm nút UI thật, không gọi API thay cho submit.

## Cách tự test

1. Đăng nhập Quản lý → Khóa học → Đợt mở khóa học → Tạo đợt mở.
2. Chọn khóa PUBLISHED, HLV ACTIVE và phòng ACTIVE; nhập mã mới, học phí 1001, sức chứa 2, tối thiểu 1, tổng buổi 4.
3. Chọn thứ 2–4–6, khai giảng 03/02/2031, giờ 18:00–19:00: xem trước phải có 4 ngày 03,05,07,10/02 và kết thúc 10/02/2031 19:00.
4. Đổi ngày sang 04/02: phải báo sai thứ và không cho tạo. Sửa lại; thử giờ kết thúc <= bắt đầu hoặc tổng buổi 0: phải chặn. Sửa hợp lệ để tiếp tục.
5. Mở đăng ký trước đóng đăng ký, đóng trước giờ khai giảng. Thử số tối thiểu vượt sức chứa hoặc ngày đăng ký không tồn tại: phải báo lỗi.
6. Để lưu thành công, chọn lịch/phòng/HLV chưa bị chiếm và mã đợt mới. Bấm Tạo đợt và lịch học: trang chi tiết có đủ buổi ngay, không thêm tay.
7. Bấm Mở đăng ký → Xác nhận. Mở /course-runs/{id} ở cửa sổ chưa đăng nhập: xem được lịch trước khi đăng ký.

## Kết quả tự động và phạm vi

- npm run build: PASS; còn cảnh báo chia bundle authService có sẵn, không làm build thất bại.
- npm run lint: PASS, không cảnh báo.
- npm test: PASS 40/40, gồm 3 test mới.
- Không chạy lại thanh toán/checkout hội viên trong lượt này; đã xác minh tới mở đăng ký và lịch công khai. Test PostgreSQL/Testcontainers của BE vẫn theo giới hạn ghi trong handoff BE.

## Dữ liệu QA còn lại

- runCode: QA-FE-WEEKLY-20261105.
- runId: eb95a88d-5dfd-4170-9788-5384c5e5f667.
- Trạng thái sau dọn QA: CANCELLED; phòng F1-020; HLV Anh Bô Xin; lịch gốc 03,05,07,10/02/2031 18:00–19:00.
- API cancellation-impact xác nhận enrollmentCount=0, pendingOrderCount=0 tại lúc kiểm tra.
- Người dùng đã cho phép tiếp tục dọn dữ liệu QA. Chrome MCP đã bấm Hủy đợt mở, xác nhận tác động 0 đăng ký/0 đơn chờ, nhập lý do và xác nhận hủy. Trang chi tiết trả trạng thái Đã hủy; không tạo thanh toán hoặc đăng ký hội viên. Bản ghi được giữ để tra cứu lịch sử.
- Lỗi phát hiện sau hủy đã sửa ở lượt tiếp theo: BE bổ sung CANCELLED cho buổi và migration V74 sửa các buổi còn sót của đợt đã hủy. Chrome MCP xác nhận cả 4 buổi cũ đã CANCELLED; hủy đợt mới cũng hủy đủ 4 buổi và tạo lại cùng phòng/HLV/giờ thành công. FE khóa thêm/sửa buổi của đợt đã hủy. Chi tiết: backend/docs/COURSE_RUN_CANCEL_SESSIONS_FIX.md.
