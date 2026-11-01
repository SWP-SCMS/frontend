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
| G13 — Quyền học trong lúc chờ rút (đã chốt) | Tạm ngừng học/điểm danh từ khi gửi thành công, giữ chỗ chờ duyệt. Duyệt thì rút và trả chỗ; Member được hủy khi còn chờ, Reception được hủy hộ; hủy hoặc Manager từ chối thì khôi phục quyền học, không bù buổi đã lỡ. Manager duyệt/từ chối từng yêu cầu. BE/FE hiện chưa triển khai rule mới này. |
| G14 — Reception thao tác hộ Member trong Course (đã chốt) | Đối chiếu/bổ sung API Reception cho các thao tác Member Course, gồm hủy yêu cầu rút, waitlist, phản hồi đổi lịch và chấp nhận chuyển đợt. Cùng điều kiện/thời hạn, lưu actor và audit. Không cấp quyền tạo Course/Run, duyệt/từ chối, xem giáo án hoặc kết quả tập luyện. Chi tiết G14 bên dưới. |
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
- Contract cần trả snapshot và trạng thái xử lý để FE trình bày. Yêu cầu cũ chưa có snapshot được coi là legacy; user cho phép cân nhắc dọn dữ liệu nếu cần. Không giả lập snapshot lịch sử bằng dữ liệu hiện tại. Chưa thực hiện xóa database; khi dọn cần xác định đúng tập dữ liệu và quan hệ phụ thuộc.

## G13 — Quyền học/điểm danh trong thời gian chờ rút, đã được user chốt ngày 2026-11-02
- Hiện trạng đã đọc code: CourseEnrollmentService.roster và updateAttendance cho cả ACTIVE và WITHDRAWAL_PENDING. FE hiển thị roster BE trả; lịch Member cũng giữ WITHDRAWAL_PENDING.
- Sau duyệt, WITHDRAWN bị loại khỏi roster và BE chặn điểm danh. Không xóa lịch sử điểm danh trong DB. FE cập nhật sau khi tải lại; phần này đã có, không yêu cầu BE làm lại.
- Rule đã chốt, áp dụng cùng phạm vi G12: gửi yêu cầu thành công thì chốt khoản hoàn và tạm ngừng quyền học/điểm danh từ thời điểm đó; vẫn giữ chỗ trong khi chờ. Manager duyệt thì rút chính thức, giải phóng chỗ và dùng snapshot lúc gửi; từ chối thì khôi phục quyền học.
- Quyết định mới nhất thay thế phương án bù sau từ chối: không bố trí học bù cho buổi bị lỡ trong lúc chờ, kể cả Member hủy yêu cầu hoặc Manager từ chối. Không phát sinh quyền bù riêng từ workflow rút. Học bù chung do trung tâm hủy/thay đổi buổi vẫn là nghiệp vụ độc lập.
- Giữ Manager duyệt/từ chối từng yêu cầu, bắt buộc lý do và lưu audit/thông báo. Không tự động rút và không thêm duyệt hàng loạt trong MVP.
- Member được hủy yêu cầu của mình khi còn PENDING (kể cả yêu cầu nhân viên gửi hộ); Reception được hủy hộ theo đúng điều kiện đó. Hủy thì kết thúc yêu cầu, khôi phục quyền học từ thời điểm hủy, không giải phóng chỗ và không tạo nghĩa vụ hoàn từ yêu cầu đã hủy. Không cho hủy sau khi đã duyệt/từ chối.
- Contract cần bổ sung endpoint hủy cho Member theo quyền sở hữu và endpoint Reception hủy hộ, trạng thái kết thúc tương ứng, thời điểm hủy, snapshot G12 và trạng thái/quyền học cho FE. BE kiểm soát cạnh tranh giữa hủy và Manager duyệt/từ chối: chỉ một chuyển trạng thái thành công; retry không tạo hiệu ứng trùng. Không tự đặt tên endpoint/enum ở FE trước khi BE cung cấp.
- FE cần xác nhận trước khi gửi: “Trong thời gian chờ xử lý, bạn tạm ngừng học. Những buổi diễn ra trong thời gian này sẽ không được học bù nếu bạn quay lại.” Khi hủy yêu cầu cũng hiển thị lại hệ quả này.
- BE cần enforce quyền ở roster/attendance và quyền vào trung tâm theo Course; FE hiển thị rõ tạm ngừng và đồng bộ lịch. Không chỉ ẩn nút FE hoặc xóa bản ghi lịch sử.

## G14 — Reception thao tác hộ Member trong nghiệp vụ Course (đã chốt)
- Trong phạm vi Course của handoff này, thao tác nghiệp vụ Member được phép làm thì Reception cũng được làm hộ: đăng ký/thanh toán theo contract, vào/rời waitlist, nhận lời mời, phản hồi đổi lịch, gửi/hủy yêu cầu rút, xem/chấp nhận đề nghị chuyển và thanh toán chênh lệch.
- Áp dụng cùng eligibility, deadline, capacity, xung đột lịch, snapshot/refund policy và trạng thái với Member; không vượt giới hạn chỉ vì người thao tác là Reception.
- Quyền tạo Course/Run và duyệt/từ chối vẫn thuộc Manager. Rule làm hộ không mở rộng sang quyền xem giáo án/kế hoạch hoặc kết quả tập luyện của Member, đổi mật khẩu, truy cập phiên đăng nhập hoặc các chức năng tài khoản riêng tư.
- BE cần đối chiếu toàn bộ endpoint Member Course và cung cấp endpoint Reception tương ứng cùng API tra cứu cần thiết. Ghi nhận actor là Reception, member thụ hưởng, audit và notification; không giả mạo token Member hoặc dùng API Manager.
- Đã có luồng đăng ký/thanh toán và gửi rút hộ. Hủy rút hộ và các luồng làm hộ còn lại cần kiểm kê contract trước khi FE triển khai; không khẳng định toàn bộ đã được hỗ trợ.
- FE cần chọn đúng hội viên, hiển thị tên/mã và hệ quả trước khi xác nhận thao tác hộ. Không nhập UUID thủ công hoặc N+1 workaround.

## Cần test local
- Retry disbursement giữ payload/key; không bấm đúp; stale version, eligibility đổi, 0/null, cash/bank transfer và Manager verify.
- G12: gửi lúc còn 7/10, duyệt lúc còn 6/10 vẫn dùng snapshot; duyệt sau buổi cuối được phép; gửi mới sau mốc đó bị chặn.
- Member rút do đổi lịch: tạo đúng một request, trạng thái chờ tạm ngừng học theo G13 sau khi BE cập nhật; từ chối/duyệt cập nhật trạng thái; ngưỡng 70% và ba ngoại lệ.
- G13: chờ duyệt vẫn giữ chỗ nhưng không được học/điểm danh; duyệt trả chỗ; hủy/từ chối khôi phục quyền từ thời điểm xử lý, không tạo buổi bù cho buổi đã lỡ; lịch sử cũ được giữ nguyên.
- Hủy yêu cầu: Member đúng chủ sở hữu hoặc Reception làm hộ đúng hội viên, chỉ PENDING; cạnh tranh hủy/duyệt/từ chối và retry không trả chỗ hoặc tạo khoản hoàn sai. FE tải lại khi trạng thái đã đổi.
- Coach: đúng assignment, ngoài cửa sổ điểm danh bị chặn, hết quyền giữa lúc mở roster.
- Reception rút hộ đúng accountId, số hoàn dự kiến và lỗi hồ sơ đổi trạng thái.
- Manager cancel-with-makeup rollback khi trùng lịch; giảm số buổi chỉ buổi chưa bắt đầu.
- Course-only không có quyền gym/PT; notification, trạng thái trống và lỗi tải.
