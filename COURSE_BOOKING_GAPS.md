# Course Booking — đối chiếu FE/BE

Ngày 2026-11-02. FE: course-workflow; BE local: 7e8f551 (PR #192), diff từ 8ba06c6. Không sửa backend. Chưa kiểm thử runtime/E2E trong đợt này.

## Đã nối FE
- Reception xem hàng chờ và ghi nhận chi hoàn: version, eligibility, idempotency, RHF + Zod, xác nhận khoản chi; không tự chuyển tiền.
- Member timeline: Run/session status, payment summary, makeup; bỏ lịch Run hủy/buổi không còn hiệu lực.
- Waitlist dùng tên/mã trực tiếp, bỏ lookup catalog trang đầu. Transfer, withdrawal và refund Manager dùng display fields trực tiếp.
- Phản hồi REQUEST_WITHDRAWAL tạo yêu cầu rút theo BE; hiển thị eligibility/refundAmountVnd, reload ghi danh và lịch sử.
- Coach /coach/course-sessions: discovery theo assignment, roster, điểm danh theo attendanceWritable. BE là nguồn quyền cuối cùng.
- Reception tra cứu enrollment và yêu cầu rút hộ trên /reception/courses sau khi tìm hội viên.
- Manager sửa lịch Run/số buổi, hủy kèm xếp bù qua endpoint nguyên tử; makeup không được xếp bù tiếp.

## Gap còn lại
| Mục | Contract / việc cần bổ sung |
|---|---|
| Quyền tạo Course ở BE | BE hiện còn POST /reception/courses và workflow duyệt. Cần gỡ/chặn quyền Reception tạo Course theo rule mới; không bổ sung API tạo Run hoặc danh sách bộ môn cho mục đích này. FE ẩn UI không thay thế kiểm soát quyền API. |
| Hoàn cuối khóa | Refund thường chỉ được chi khi Run COMPLETED. Cần xác nhận/bổ sung chuyển SETTLEMENT_PENDING sang COMPLETED; không tự coi SETTLEMENT_PENDING là đủ điều kiện chi. |
| Rút do thay đổi | BE vẫn chặn khi buổi cuối đã bắt đầu, kể cả nguyên nhân thay đổi. Nếu cần rút sau mốc này phải chốt thêm contract; FE dùng eligibility BE trả. |
| Sửa lịch Run | Các session giữ lại phải nằm trong khung Run mới. UI gửi lỗi BE, không tự dời hàng loạt buổi hoặc gọi N+1. Cần kiểm thử thao tác dời cả khóa thực tế. |

## BR đã chốt
- Cập nhật 2026-11-02: chỉ Manager tạo Course và Course Run. Reception đăng ký hộ member, không tạo/gửi duyệt Course/Run. Quyết định này thay thế rule Reception tạo chờ duyệt trong handoff cũ. FE đã gỡ màn duyệt Course do Reception gửi; các quyền rút hộ/chi hoàn đã chốt riêng không bị thay đổi.
- G01: COURSE_RUN_CANCELLED, PAYMENT_EXCEPTION, TRANSFER_CREDIT_EXCESS được chi sau Manager duyệt; khoản khác chờ Run kết thúc (contract hiện dùng COMPLETED).
- G10: tự nguyện rút còn ít nhất 70% số buổi thì hoàn 80% giá trị còn lại; dưới ngưỡng được rút nhưng không hoàn. Dời khai giảng quá 7 ngày/trùng lịch/giảm số buổi: hoàn 80% giá trị còn lại, không áp ngưỡng 70%. FE không tự tính số tiền.
- G11: Manager sửa và áp dụng trực tiếp; buổi bị ảnh hưởng phải có lịch dời/bù cụ thể; không cần workflow tự gửi/tự duyệt.

## Cần test local
- Retry disbursement giữ payload/key; không bấm đúp; stale version, eligibility đổi, 0/null, cash/bank transfer và Manager verify.
- Member rút do đổi lịch: tạo đúng một request, chờ duyệt giữ lịch; từ chối/duyệt cập nhật trạng thái; ngưỡng 70% và ba ngoại lệ.
- Coach: đúng assignment, ngoài cửa sổ điểm danh bị chặn, hết quyền giữa lúc mở roster.
- Reception rút hộ đúng accountId, số hoàn dự kiến và lỗi hồ sơ đổi trạng thái.
- Manager cancel-with-makeup rollback khi trùng lịch; giảm số buổi chỉ buổi chưa bắt đầu.
- Course-only không có quyền gym/PT; notification, trạng thái trống và lỗi tải.
