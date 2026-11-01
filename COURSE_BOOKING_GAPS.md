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
| G12 — Chốt quyền hoàn tại lúc gửi (đã chốt) | BE hiện tính lại tại approve và chặn cả duyệt khi buổi cuối đã bắt đầu. Cần lưu snapshot khi gửi; duyệt yêu cầu cũ dùng snapshot, không mất quyền vì Manager xử lý trễ. Chi tiết bên dưới. |
| G13 — Quyền học trong lúc chờ rút (cần hoàn thiện BR) | BE/FE hiện vẫn cho WITHDRAWAL_PENDING học và điểm danh. Cần đồng bộ với G12; phương án tạm ngừng học còn phải chốt cách xử lý buổi bị lỡ nếu từ chối. |
| Sửa lịch Run | Các session giữ lại phải nằm trong khung Run mới. UI gửi lỗi BE, không tự dời hàng loạt buổi hoặc gọi N+1. Cần kiểm thử thao tác dời cả khóa thực tế. |

## BR đã chốt
- Cập nhật 2026-11-02: chỉ Manager tạo Course và Course Run. Reception đăng ký hộ member, không tạo/gửi duyệt Course/Run. Quyết định này thay thế rule Reception tạo chờ duyệt trong handoff cũ. FE đã gỡ màn duyệt Course do Reception gửi; các quyền rút hộ/chi hoàn đã chốt riêng không bị thay đổi.
- G01: COURSE_RUN_CANCELLED, PAYMENT_EXCEPTION, TRANSFER_CREDIT_EXCESS được chi sau Manager duyệt; khoản khác chờ Run kết thúc (contract hiện dùng COMPLETED).
- G10: tự nguyện rút còn ít nhất 70% số buổi thì hoàn 80% giá trị còn lại; dưới ngưỡng được rút nhưng không hoàn. Dời khai giảng quá 7 ngày/trùng lịch/giảm số buổi: hoàn 80% giá trị còn lại, không áp ngưỡng 70%. FE không tự tính số tiền.
- G11: Manager sửa và áp dụng trực tiếp; buổi bị ảnh hưởng phải có lịch dời/bù cụ thể; không cần workflow tự gửi/tự duyệt.

## G12 — Snapshot yêu cầu rút, đã được user chốt ngày 2026-11-02
- Áp dụng cả Member tự gửi, Reception/Manager gửi hộ và yêu cầu phát sinh từ phản hồi đổi lịch.
- Khi gửi thành công: lưu thời điểm, nguyên nhân rút, tổng số buổi, số buổi còn lại, căn cứ giá trị còn lại, quyền hoàn và số tiền hoàn do BE tính. Rule 70%/80% và ngoại lệ theo G10 giữ nguyên.
- Khi Manager duyệt: dùng snapshot đã lưu, không tính lại vì thời gian chờ duyệt. Yêu cầu gửi lúc còn 7/10 buổi không mất quyền hoàn chỉ vì lúc duyệt còn 6/10.
- Buổi cuối bắt đầu chỉ chặn yêu cầu mới. Yêu cầu đã gửi trước đó vẫn được Manager duyệt/từ chối; không chặn approve vì số buổi còn lại hiện tại bằng 0.
- Chỉ giải phóng chỗ khi duyệt thành công. Thời điểm chi tiền vẫn theo G01, không chi ngay chỉ vì đã duyệt rút.
- BE hiện tại: CourseWithdrawalService.create/createForScheduleChange kiểm tra remainingUnits; approve gọi refundSnapshot với thời điểm hiện tại và kiểm tra canWithdraw lần nữa. Đây là phần cần sửa.
- Contract cần trả snapshot và trạng thái xử lý để FE trình bày; BE xác định cách xử lý các yêu cầu PENDING cũ chưa có snapshot, không tự lấy dữ liệu hiện tại rồi gọi đó là dữ liệu lúc gửi.

## G13 — Quyền học/điểm danh trong thời gian chờ rút
- Hiện trạng đã đọc code: CourseEnrollmentService.roster và updateAttendance cho cả ACTIVE và WITHDRAWAL_PENDING. FE hiển thị roster BE trả; lịch Member cũng giữ WITHDRAWAL_PENDING.
- Sau duyệt, WITHDRAWN bị loại khỏi roster và BE chặn điểm danh. Không xóa lịch sử điểm danh trong DB. FE cập nhật sau khi tải lại; phần này đã có, không yêu cầu BE làm lại.
- Phương án đã trao đổi để tránh vừa học thêm vừa hoàn theo G12: tạm ngừng quyền học/điểm danh từ lúc gửi; vẫn giữ chỗ trong khi chờ. Duyệt thì rút chính thức và trả chỗ; từ chối thì khôi phục quyền học.
- Còn cần chốt: buổi bị lỡ do tạm ngừng trong thời gian chờ nếu Manager từ chối sẽ được xử lý thế nào. Chưa tự chọn học bù, hoàn tiền hoặc coi là vắng.
- Sau khi chốt đầy đủ, BE cần enforce quyền ở roster/attendance và quyền vào trung tâm theo Course; FE hiển thị rõ tạm ngừng và đồng bộ lịch. Không chỉ ẩn nút FE hoặc xóa bản ghi lịch sử.

## Cần test local
- Retry disbursement giữ payload/key; không bấm đúp; stale version, eligibility đổi, 0/null, cash/bank transfer và Manager verify.
- G12: gửi lúc còn 7/10, duyệt lúc còn 6/10 vẫn dùng snapshot; duyệt sau buổi cuối được phép; gửi mới sau mốc đó bị chặn.
- Member rút do đổi lịch: tạo đúng một request, trạng thái chờ theo contract hiện tại (G13 chưa chốt đầy đủ); từ chối/duyệt cập nhật trạng thái; ngưỡng 70% và ba ngoại lệ.
- Coach: đúng assignment, ngoài cửa sổ điểm danh bị chặn, hết quyền giữa lúc mở roster.
- Reception rút hộ đúng accountId, số hoàn dự kiến và lỗi hồ sơ đổi trạng thái.
- Manager cancel-with-makeup rollback khi trùng lịch; giảm số buổi chỉ buổi chưa bắt đầu.
- Course-only không có quyền gym/PT; notification, trạng thái trống và lỗi tải.
