# Course Booking — gap gửi Backend

Ngày: 2026-11-01. Đối chiếu code BE local main `5003b72` (PR #185), không xác nhận CI/staging. FE branch `feat/course-booking-mvp`.
Tài liệu này thay thế các mô tả gap cũ về việc chưa có API refund member/disbursement/report. Chưa chạy test chức năng.

## Phần đã có, không cần yêu cầu BE làm lại
- Member tạo/xem withdrawal; Manager duyệt/từ chối withdrawal.
- Manager list/detail/approve/reject refund; verify/fail/return.
- Reception POST ghi nhận disbursement.
- Member list/detail refund đã lược bỏ evidence nội bộ.
- Báo cáo Manager Course Run tổng hợp có tên/mã, pagination và filter.
- FE đã nối member withdrawal, refund progress và báo cáo Course Run; service không tính refund thay BE.

## Gap còn lại

| ID | Mức độ / phần | Bằng chứng code hiện tại | BE cần bổ sung hoặc xác nhận |
|---|---|---|---|
| G01 | Chặn giải ngân đúng rule | CourseRefundObligationService.recordDisbursement kiểm tra APPROVED, version, amount, idempotency; lock() khóa Run nhưng không đọc/kiểm tra Run đã kết thúc. | Enforce thời điểm được ghi nhận chi ở BE theo rule chỉ quyết toán sau khi Run kết thúc. Chốt cách xử lý Run CANCELLED và các nguồn PAYMENT_EXCEPTION/TRANSFER_CREDIT_EXCESS. Trả eligibility/reason cho UI; FE không tự chọn ngoại lệ. |
| G02 | Chặn bàn giải ngân Reception | CourseRefundObligationController có POST /reception/course-refund-obligations/{id}/disburse nhưng không có GET list/detail role Reception. | API queue/detail theo quyền Reception, phân trang, số tiền đã duyệt, version, tên/mã member và Run, dữ liệu cần tác nghiệp. Không dùng API Manager hoặc nhập UUID thủ công. |
| G03 | Chặn UI duyệt rõ đối tượng | WithdrawalRequest, RefundObligation và TransferRequest/TransferOffer chủ yếu chứa UUID, thiếu fullName/memberCode và courseName/runCode cần thiết. | Bổ sung display fields trực tiếp trong response phù hợp role (đặc biệt member, source/target Run). Không buộc FE gọi thêm API cho từng dòng. Report Run không giải quyết việc thiếu danh tính member. |
| G04 | Chặn rút hộ tại quầy | Có POST withdrawal theo memberId/enrollmentId nhưng không có API chọn enrollment của member dành cho Reception. | Read API trả enrollment được phép thao tác, tên/mã Run, lifecycle, eligibility và lý do không đủ điều kiện. |
| G05 | Chặn Coach discovery | CourseEnrollmentController chỉ có roster/attendance theo sessionId; chưa có danh sách Course Run/session theo assignment. | List/detail scoped coach với tên/mã, lịch, trạng thái và cửa sổ điểm danh; không quét catalog rồi thử từng session. |
| G06 | Chặn Reception tạo Course chờ duyệt | CourseController chỉ /manager; CourseStatus/CourseRunStatus không có workflow pending approval tương ứng. | Endpoint tạo/gửi duyệt cho Reception, queue/approve/reject Manager và state transition; giữ Manager tự tạo/tự duyệt. |
| G07 | Member lịch/trạng thái chưa đủ | MemberEnrollment/MemberSession thiếu Run status, payment summary, session status và liên kết original/makeup. | Trả dữ liệu tổng hợp trong endpoint enrollment hiện có để không hiện lịch Run đã hủy hoặc buổi chờ bù như buổi đang học; không dùng per-enrollment order/run lookups. |
| G08 | Waitlist thiếu tên | CourseWaitlistResponse chỉ có courseRunId, status/position/timestamps. | Trả courseName/courseCode/runCode kể cả khi Run không còn public. FE hiện chỉ có tên best effort từ catalog trang đầu 100 Run; không xem đó là nguồn đầy đủ. |
| G09 | Session makeup UI chưa đủ | CourseSessionResponse có replacementSessionId nhưng không có isMakeup; BE từ chối xếp bù trên một makeup. | Trả isMakeup/originalSessionId hoặc allowedActions để FE không mở thao tác mà BE chắc chắn từ chối. |
| G10 | Rule material change còn cần chốt | ScheduleChangePolicy dùng lệch >30 phút/đổi ngày và response deadline. | Xác nhận riêng điều kiện rút do khai giảng dời >7 ngày, trùng lịch, giảm số buổi; phân biệt với ngưỡng 70% của tự rút. Trả eligibility phía BE, không buộc FE suy diễn. |
| G11 | Duyệt thay đổi và buổi ảnh hưởng | Có cancel/makeup trực tiếp; chưa có workflow duyệt thay đổi buộc xử lý buổi ảnh hưởng trước khi duyệt. | Chốt/triển khai điều kiện reschedule hoặc makeup trước khi approve thay đổi liên quan theo rule đã thống nhất. |

## Ngoài phạm vi đã chốt / cần quyết định sản phẩm
- Course ARCHIVED hiện không có restore/publish lại. INACTIVE có thể publish lại. Plan bàn giao không yêu cầu restore archive; chỉ bổ sung nếu owner quyết định cần.
- Các màn Manager quyết định/Reception giải ngân/Coach assignment/transfer đầy đủ vẫn chưa triển khai FE do gap trên, không phải toàn bộ endpoint nghiệp vụ đều chưa có.
- Báo cáo hiện hiển thị theo Run với bộ lọc ngày/trạng thái; API cũng có runId nhưng FE chưa có bộ chọn Run riêng.

## Kiểm tra thủ công còn lại
- Refund member: pagination, lỗi tải/retry, null khác 0, trạng thái APPROVED khác DISBURSEMENT_RECORDED/COMPLETED, không lộ evidence hoặc UUID.
- Report: ngày Việt Nam, [startDate,endDate), tối đa 366 ngày khi có cả hai đầu, empty/error, pagination và các số tổng hợp so với BE.
- Notification: đúng nhãn, không diễn giải APPROVED thành đã trả tiền. Member mở /member/courses. Manager verification routing còn chờ màn queue đủ dữ liệu.
- Regression capacity/conflict/course-only entitlement và E2E chưa chạy. Lint/diff check không thay cho nghiệm thu runtime.
