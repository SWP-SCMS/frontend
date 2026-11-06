## Cập nhật mới nhất — FE theo BE 09215bd (03/11/2026)

- Đã đọc diff b25f40c..09215bd: #200 bổ sung đối soát Course riêng, #201 enforce Run attendance policy và mở rộng regression BE. Không sửa backend.
- G15: BE đã có queue/detail/reconcile/result dưới /course-payments, Manager và Reception đều có quyền. FE đã triển khai màn Đối soát khóa học, phân trang/tìm kiếm, RHF+Zod, eligibility từ BE, lỗi tiếng Việt, retry giữ key/payload khi chưa rõ kết quả, kiểm tra lại result. Không gọi /payments của Membership hoặc N+1.
- Các lỗi FE đã sửa trong source: phân biệt buổi gốc hủy/bù, không đếm record thành đơn vị học; cảnh báo theo hành động; refetch các panel Reception sau mutation; mô tả snapshot chốt khi gửi; ENROLLED là phân bổ lịch sử; thông báo lỗi attendance gồm trạng thái Run.
- Lịch sử G15 FAIL bên dưới thuộc runtime cũ b25f40c, không còn là kết luận thiếu API ở HEAD mới. Màn FE mới chưa được nghiệm thu end-to-end với thanh toán trên runtime BE 09215bd.
- Tài liệu BE báo CI PostgreSQL của #200 thành công; đó là thông tin bàn giao, không phải kết quả UI local đã chạy. Hai tài liệu tiếp tục không commit.

---

## Tiến độ FE ngày 03/11/2026

Đã commit G12/G13: snapshot theo dữ liệu BE, Member hủy yêu cầu với lý do RHF+Zod, cảnh báo ngừng học/không bù, trạng thái learningSuspended. Đã nối Reception G14: waitlist vào/rời/nhận chỗ, phản hồi lịch, chấp nhận chuyển và mở đơn chênh lệch qua màn thanh toán sẵn có; xem lịch sử rút/refund phân trang, hủy rút hộ. Chỉ dùng endpoint Reception theo member đã tra cứu, không N+1. Thông báo hủy rút/hoàn thành có nhãn Việt.

Chưa xác nhận runtime/E2E: cần chạy đúng BE b25f40c với V68/V69, test 4 role, quyền/hạn xử lý, lỗi mạng và idempotency, snapshot khi duyệt trễ, dữ liệu legacy và khôi phục quyền học. Không coi đã pass chỉ vì FE đã nối API. Đã lint các file sửa, không chạy test tự động theo nguyên tắc user tự test. Hai tài liệu này vẫn ngoài commit.

---

# Cập nhật đồng bộ BE b25f40c — 02/11/2026

BE đã bổ sung quyền tạo Manager-only, snapshot/hủy rút G12-G13, tự hoàn thành Run, reschedule nguyên tử và Reception proxy G14. Các gap BE cũ bên dưới là lịch sử, cần kiểm thử lại sau đồng bộ.

FE branch feat/course-remediation-sync: đã nối POST /manager/course-runs/{runId}/reschedule trong form RHF+Zod, cho sửa khung Run và lịch từng buổi một lần; giữ key/payload khi retry lỗi mạng/5xx. Chưa test runtime bản BE mới. Không tự dời tất cả buổi theo ngày khai giảng: Manager chọn lịch từng buổi ngay trong form.

Còn phải triển khai FE: G12/G13 snapshot/cancel, trạng thái learningSuspended và giữ lịch sử; Reception G14 waitlist/response/transfer/history/cancel hộ; cập nhật thông báo và QA tích hợp. Không còn coi các API này là BE chưa cung cấp. Hai tài liệu local không commit.

---

# Course Booking — đối chiếu FE/BE

Ngày 2026-11-02. FE: course-workflow; BE local: 7e8f551 (PR #192), diff từ 8ba06c6. Không sửa backend. Đã thử sửa lịch Run bằng Chrome DevTools MCP; bị chặn bởi API runtime (chi tiết bên dưới), chưa xác nhận E2E luồng dời cả khóa.

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

## Kiểm thử sửa lịch Run — đã restart và xác nhận validation thực tế
- Kiểm thử tiếp theo theo yêu cầu user: **nới khung Run → dời session → thu khung Run đã thành công**, cả 3 request HTTP 200 trên QA-CHROME-RUN-02. Đọc lại xác nhận lịch 07/11/2026 16:00–17:00 (+07), Run version 3/session version 1; giữ lịch mới vì test thành công. Cách tái hiện và yêu cầu BE xử lý nguyên tử: [COURSE_RUN_RESCHEDULE_HANDOFF.md](COURSE_RUN_RESCHEDULE_HANDOFF.md). Không thêm vòng gọi N+1 vào FE.
- Cập nhật sau restart theo yêu cầu user: dừng PID 33984, chạy source hiện tại bằng Maven profile local; PID mới 5932 LISTEN 8080. GET /api/v1/v3/api-docs trả 200 và có PATCH /manager/course-runs/{runId}/schedule. Lỗi 404 route và 500 tài liệu ở tiến trình cũ đã hết.
- Chrome DevTools MCP trên QA-CHROME-RUN-02: dời Run từ 06/11 sang 07/11 trả 400 COURSE_VALIDATION_ERROR, field plannedStartAt: retained sessions must have a schedule inside the Run window. Dời session trước sang 07/11 trả 409 COURSE_SESSION_INVALID. Đã xác nhận lại bằng API GET: ngày/giờ/version Run và session không đổi, ID khớp đúng bản ghi. Đây là giới hạn nghiệp vụ/API thật sau khi đã loại trừ lỗi chạy bản cũ.
- BE vẫn đang chạy để user tiếp tục test. Không sửa source BE hoặc cấu hình. Phép thử nới/dời/thu sau đó đã được thực hiện thành công trên DB thật theo yêu cầu riêng của user, xem handoff phía trên.
- Thử lại qua form FE cũng bị validation; UI hiển thị “Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.” Chưa giải thích cụ thể quan hệ lịch Run/session cho người dùng; cần cải thiện thông báo FE khi triển khai contract dời lịch. Đã đóng form và tải lại trang.

### Lịch sử kiểm tra trước restart
- Chrome DevTools MCP, phiên Manager, FE localhost:5175 / API localhost:8080. Dữ liệu QA-CHROME-RUN-02: một buổi 06/11/2026, 16:00–17:00 (UTC+07).
- Thao tác qua form “Sửa lịch / số buổi đợt học”: chuyển cả ngày bắt đầu/kết thúc sang 07/11/2026, giữ giờ và số buổi. PATCH /api/v1/manager/course-runs/{runId}/schedule trả HTTP 404, code NOT_FOUND, detail “No static resource manager/course-runs/{runId}/schedule.” FE hiện “Không áp dụng được lịch mới.”
- Đã xác định PID 33984 LISTEN cổng 8080; jcmd xác nhận user.dir là backend và classpath bắt đầu bằng backend/target/classes. Tiến trình khởi động 01/11/2026 22:55:43; reflog xác nhận pull 5003b72 -> 7e8f551 lúc 02/11/2026 02:47:51 (+07). Controller ở 5003b72 chưa có PATCH /schedule; source mới có. Cần restart đúng bản mới để nạp endpoint; build/test riêng không cập nhật class đã nạp trong tiến trình đang chạy. Chưa restart server trong lần kiểm tra chỉ đọc này.
- ĐÍNH CHÍNH nhận định ID số 0: so sánh trực tiếp trong JavaScript cho runIdIsZero=false, runIdMatchesRequested=true, session.runIdMatchesRequested=true; course/coach/room/session ID cũng không phải UUID 0. JDBC và phép so sánh SQL cho kết quả tương tự. Đầu ra chuỗi UUID qua công cụ gây hiểu nhầm; không có bằng chứng lỗi ID số 0 ở BE, không yêu cầu BE sửa DB/serialization theo nhận định cũ.
- Chưa cập nhật lịch thành công, chưa thay đổi dữ liệu khóa học. Đã đóng form thử nghiệm.
- Sau khi môi trường đúng: thử dời Run trước, dời session trước, và xác nhận cách cập nhật cả lịch nhất quán. Source hiện yêu cầu các session giữ lại nằm trong khung Run mới, còn session phải nằm trong khung Run hiện tại. Không coi phép thử bị 404 là bằng chứng runtime bị khóa vòng; không tự thêm vòng gọi N+1 để né validation.

## Kết quả kiểm thử code BE ngày 2026-11-02
- BE main 7e8f551: Maven chạy 41 test, 0 failure/error/skip: CourseControllerTests (10), CourseManagementServiceTests (12), CourseSessionServiceTests (4), CourseScheduleChangeServiceTests (10), CourseScheduleChangePolicyTests (4), CourseManagerOpenApiTests (1). Test OpenAPI kiểm tra tài liệu tĩnh, không chứng minh server 8080 đã nạp route mới.
- Probe độc lập ngoài repository BE gọi service/entity thật với repository/JDBC mock: dời Run sang khung mới không chứa buổi cũ bị COURSE_VALIDATION_ERROR; dời buổi trước ra ngoài khung Run cũ bị COURSE_SESSION_INVALID. Đây là hành vi code đã tái hiện, khác lỗi 404 runtime ở trên.
- Nới rộng khung Run để chứa cả lịch cũ/mới, dời buổi, rồi thu khung Run về lịch mới chạy được ở mức service. Chưa kiểm tra giao dịch DB, thông báo/quyền rút, concurrency hoặc lỗi giữa các bước. Không triển khai cách gọi nhiều request này làm workaround FE.
- Nếu cần thao tác “dời cả khóa” trong một lần áp dụng: đề nghị BE bổ sung contract cập nhật Run cùng lịch các session trong một giao dịch, kiểm tra tài nguyên/xung đột/version và phát sinh tác động học viên nhất quán. Endpoint hiện tại chỉ đổi khung Run, không tự dời từng buổi.
- Probe mapping CourseRunResponse/CourseSessionResponse giữ nguyên UUID của entity. Kiểm tra API/DB bằng biểu thức so sánh xác nhận ID thật đúng, xem đính chính bên trên. SELECT chỉ đọc cho thấy DB đã có migration 67; không đồng nghĩa tiến trình Java cũ đã nạp code mới.
- Chưa chạy Testcontainers PostgreSQL: không tìm thấy Docker trong PATH hoặc đường dẫn cài đặt Windows thường dùng. Không dùng DB local thay cho DB test. Không sửa source BE; Maven chỉ tạo/cập nhật build output, git status BE không phát sinh thay đổi mới.
- Kiểm tra thêm GeneratedOpenApiTests trên source mới: 41/41 pass, bao gồm sinh tài liệu bằng MockMvc và contract route /schedule. Tổng hai đợt: 82 test pass. Server cũ ở 8080 hiện trả HTTP 500 INTERNAL_ERROR cho GET /api/v1/v3/api-docs; chưa có stack trace của tiến trình đó, không quy kết một dòng source mới là nguyên nhân. Cần kiểm tra lại sau khi restart bản mới.
- Vị trí giới hạn dời cả Run: CourseManagementService.java:312–314 chặn khung mới không chứa session giữ lại; CourseSessionService.java:119–120 chặn session ngoài khung hiện tại. Contract CourseRunScheduleRequest chỉ có version, start/end và totalUnits, không nhận lịch mới của các buổi. Đây là phần BE cần thiết kế bổ sung nếu hỗ trợ dời cả khóa nguyên tử, không phải endpoint /schedule bị thiếu trong source.

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

## Kiểm thử Chrome DevTools MCP ngày 03/11/2026

FE baba59c (feat/course-remediation-sync), BE b25f40c. Chỉ thao tác dữ liệu QA; không sửa source BE, không chuyển tiền ngân hàng thật. User đã đồng ý dùng tiền mặt QA sau khi Manager recon bị chặn.

### Lỗi/gap mới xác nhận

- **G15 — Manager đối soát Course chưa được hỗ trợ (BE):** Member tạo đơn và payment SePay thành công, nhưng GET /payments/reconciliation-queue tìm theo orderReference trả 0 bản ghi. POST /payments/{coursePaymentId}/reconcile bằng Manager trả 404 PAYMENT_NOT_FOUND. PaymentService.reconciliationQueue chỉ join payments/membership_orders; PaymentFulfillmentService.payment cũng chỉ đọc bảng membership. Cần BE cung cấp đối soát Course (queue, detail/result, confirm, quyền, amount/reference, idempotency và fulfillment enrollment) hoặc mở rộng endpoint hiện có; FE nối theo contract. Không dùng webhook giả hay ghi DB để coi là pass.
- **Cấu hình local:** thiếu SEPAY_BANK_DESTINATION_SHA256, tạo QR trả 503 PAYMENT_DESTINATION_CONFIGURATION_INVALID. Đã chạy lại BE với checksum tạm trong environment tính từ bộ thông tin ngân hàng sẵn có; QR thành công. Không sửa .env hoặc source. Cần cấu hình checksum đúng khi chạy server lần sau.
- **FE — các panel Reception chưa tự đồng bộ:** thu tiền thành công nhưng danh sách enrollment vẫn cũ cho đến khi bấm Tải lại đăng ký; gửi rút hộ xong nhưng Lịch sử yêu cầu rút chưa có yêu cầu vừa tạo cho đến khi tải lại panel. Cần refresh chung sau mutation thành công.
- **FE — câu chữ duyệt rút còn cũ:** ManagerCourseWorkflowPage.jsx:50 nói số buổi/tiền hoàn xác định tại thời điểm duyệt, trái snapshot REQUEST_TIME đã trả. Cần sửa mô tả theo snapshot của hồ sơ.
- **FE — nhãn timeline dễ hiểu sai:** enrollment WITHDRAWN/TRANSFERRED và pending vẫn hiện disposition ENROLLED là "Có suất học" trên từng buổi. Cần phân biệt lịch sử suất đã cấp với quyền học hiện tại; banner pending hiện đã đúng.

### Kết quả đã kiểm tra

| Ca | Kết quả / mức kiểm tra |
|---|---|
| Đăng nhập Manager, Member, Coach, Reception | PASS trên UI với 4 tài khoản được cấp |
| Member mở chi tiết Run, tạo đơn giữ chỗ | PASS UI, POST 201; hết 15 phút đơn cũ hiển thị Đã hết hạn |
| Tạo QR | PASS UI sau bổ sung cấu hình runtime; trước đó 503 cấu hình |
| Manager recon Course | FAIL, queue rỗng và POST 404 như G15 |
| Reception tra cứu MB-100019, chọn Run, tạo đơn mới | PASS UI |
| Reception xác nhận tiền mặt QA 1.000 VND | PASS UI qua modal; GET order xác nhận PAID/ENROLLED/payment PAID |
| Sửa Run + 2 session nguyên tử | PASS UI, một POST reschedule 200; lịch 12–13/11 chuyển 14–15/11, Coach thấy lịch mới |
| Reception gửi yêu cầu rút hộ | PASS UI; PENDING, snapshot REQUEST_TIME, 2/2 buổi, refund 800, learningSuspended true |
| Member xem snapshot và hủy yêu cầu rút | PASS UI; sau hủy GET enrollment ACTIVE và learningSuspended false |
| Member gửi yêu cầu mới | PASS API trong browser, không tính là submit UI; snapshot 800 |
| Coach roster khi pending | PASS API trong browser, roster rỗng cho session được phân công |
| Coach xem lịch/roster | PASS UI; Run chưa hoạt động, chưa được điểm danh; chưa kiểm ghi điểm danh trong cửa sổ hợp lệ |
| Manager duyệt rút | PASS UI, APPROVED, giữ snapshot 800 |
| Manager duyệt khoản hoàn | PASS UI, APPROVED 800, disbursed 0 |
| Reception xem điều kiện chi | PASS UI/API, AWAITING_COURSE_COMPLETION, eligible false; chưa chi |
| Coach vào trang Manager | PASS chặn FE /forbidden; GET Manager API 403 |
| Reception tạo Course và đọc Manager Run | PASS chặn API 403 |
| Reception lịch sử thay đổi/transfer/rút/refund | PASS đọc và render dữ liệu; chưa kiểm các mutation proxy còn lại |

### Phạm vi chưa xác nhận ở lần kiểm tra đầu (cập nhật bổ sung bên dưới)

Chưa chứng nhận toàn bộ Course E2E: waitlist vào/rời/nhận chỗ và notification; chuyển đợt và đơn chênh lệch; hủy rút hộ; Manager từ chối yêu cầu mới; điểm danh trong cửa sổ và assignment khác; các ngưỡng 7/10–6/10, duyệt trễ; completion tự động; payout/verify sau hoàn thành; cancel/makeup và rollback; course-only; race/retry/idempotency. Cần fixture phù hợp cho từng ca; không coi đọc code hoặc dữ liệu lịch sử là đã test mutation.

### Dữ liệu QA giữ lại

Run QA-20261103-E2E-01, 2 buổi 14–15/11/2026 09:00–10:00 (+07), Coach Võ Lực Sĩ, F1-021, capacity/minimum 1, học phí 1.000 VND. Đơn SePay COR-9F9EAF583B2C4B41B56C44DD21C37FF6 đã hết hạn. Đơn tiền mặt COR-D7F96488AABA49BB92A13EE3C58F09EC đã PAID; yêu cầu rút thứ nhất đã CANCELLED, thứ hai APPROVED; khoản hoàn 800 VND APPROVED chưa chi. Không xóa dữ liệu QA/audit. Hai file tài liệu tiếp tục không commit.

### Kiểm tiếp ngày 03/11/2026 — thêm Member MB-100024

| Ca | Kết quả / mức kiểm tra |
|---|---|
| Reception hủy rút hộ MB-100019 trên Run E2E-02 | PASS UI; yêu cầu CANCELLED, enrollment ACTIVE, learningSuspended false; panel enrollment cần tải lại |
| Member MB-100024 vào/rời waitlist Run đủ chỗ | PASS UI; WAITING vị trí 1 rồi LEFT |
| Vào lại và chống waitlist trùng | API setup vào lại; POST lặp trả 409 COURSE_WAITLIST_DUPLICATE |
| Manager hủy buổi kèm buổi bù | PASS UI; lịch trùng phòng/coach báo lỗi và không đổi 2 session; lịch hợp lệ tạo MAKEUP_SCHEDULED, buổi cũ CANCELLED_PENDING_MAKEUP có replacementSessionId |
| Member phản hồi thay đổi lịch để xin chuyển | PASS UI REQUEST_TRANSFER; thay đổi giờ buổi bù được tạo bằng API để chuẩn bị ca kiểm |
| Manager duyệt chuyển E2E-02 sang E2E-03 | PASS UI; offer OFFERED; học phí 1.000 sang 500 VND |
| Reception chấp nhận chuyển hộ | PASS UI; offer COMPLETED, đăng ký nguồn TRANSFERRED, đích ACTIVE; tạo nghĩa vụ hoàn chênh lệch 500 VND |
| Waitlist có chỗ sau khi người cũ chuyển | PASS scheduler tự mời; UI hiển thị lời mời, Member nhận chỗ tạo đơn; waitlist ACCEPTED |
| Reception thu tiền QA cho đơn nhận từ waitlist | PASS UI; đơn COR-ABC8B45C4C8F4FA5A4E5A17B7F35B0B6 PAID 1.000 VND; Member thấy khóa Đang theo học/Đã thanh toán |
| Notification lời mời waitlist | PASS API có COURSE_WAITLIST_INVITED; UI chuông có thông báo, mở về /member/courses |
| Hoàn chênh lệch không chờ kết thúc Run | PASS toàn bộ UI: Manager duyệt 500 → Reception ghi nhận chi CASH QA → Manager xác minh; GET refund COMPLETED, approved/disbursed/verified đều 500, Run vẫn OPEN_FOR_REGISTRATION |
| Member gửi rút và Manager từ chối | PASS cả hai submit UI; PENDING snapshot REQUEST_TIME 2/2, 800 VND, suspended true → REJECTED, suspended false; Member thấy Đang theo học và lịch sử từ chối, không có khoản hoàn mới |

#### Lỗi FE bổ sung đã tái hiện

- Màn đăng ký Member liệt kê cả buổi gốc đã hủy và buổi bù mà không phân biệt trạng thái: E2E-02 có hai dòng Buổi 1 (09:00 và 13:00 ngày 16/11) dù chỉ 2 đơn vị học. Cần lọc lịch hiệu lực hoặc ghi rõ buổi bị hủy/thay thế; không đếm bản ghi thay cho số buổi.
- Hộp xác nhận Reception “Chấp nhận chuyển hộ” lại dùng cảnh báo “Yêu cầu rút sẽ tạm ngừng học, không bù buổi đã lỡ nếu quay lại.” Cần nội dung riêng theo hành động, không dùng cảnh báo rút cho chuyển đợt.
- Lỗi panel Reception không đồng bộ còn tái hiện sau hủy rút và chuyển đợt: trạng thái đăng ký/nút rút vẫn cũ, Run đích chưa xuất hiện cho đến khi tải lại. Mutation thành công cần làm mới các panel liên quan.

#### Dữ liệu bổ sung và giới hạn còn lại

- E2E-02: capacity 1, 1.000 VND; MB-100019 đã chuyển sang E2E-03, MB-100024 đã nhận chỗ và trả tiền QA. Buổi 1 gốc 16/11 09:00 đã hủy, buổi bù 16/11 13:00–14:00; buổi 2 là 17/11 09:00–10:00 (+07). Yêu cầu rút của MB-100024 đã REJECTED, quyền học khôi phục.
- E2E-03: capacity 1, 500 VND, 18–19/11 09:00–10:00; MB-100019 ACTIVE. Khoản hoàn chênh lệch 4bfa98d2-cd5a-4072-9f0b-04586fa00e74 đã COMPLETED. Tham chiếu QA-20261103-TRANSFER-500, chứng từ ghi rõ simulated cash/no real money.
- Chưa kiểm E2E các ca phụ thuộc thời gian: điểm danh trong cửa sổ hợp lệ, snapshot 7/10 rồi duyệt lúc 6/10/sau buổi cuối, completion tự động và chi hoàn thường sau completion. Các Run QA hiện ở tương lai; không đổi đồng hồ hệ thống hay ghi DB để giả lập pass.
- Chưa kiểm đầy đủ: Course-only (Member thứ hai có gói PRE001), assignment coach khác, chuyển sang đợt đắt hơn và thanh toán phần thiếu, mọi mutation proxy waitlist/phản hồi lịch, race/retry/idempotency, các nhánh hoàn thất bại/trả lại và BANK_TRANSFER. Chưa chứng nhận toàn bộ Course E2E.
- G15 Manager recon Course vẫn FAIL. Các luồng thu/chi ở trên dùng tiền mặt QA theo chấp thuận của user; không chứng minh luồng chuyển khoản/đối soát Course hoạt động.
- Lượt kiểm này không sửa source FE/BE, không commit hai tài liệu.

### Kiểm thử BE bổ sung 03/11/2026 — các ca theo thời gian

- Đã chạy Maven offline: CourseAttendancePolicyTests (7), CourseWithdrawalPolicyTests (5), CourseRefundStateMachineTests (1), CourseRunTests (19), CourseRunClosureSchedulerTests (1): tổng 33 test PASS.
- Attendance policy đã kiểm trước/trong/sau cửa sổ (đóng chính xác end + 30 phút), buổi hủy, Run không hoạt động, Coach không được phân công. Đây là policy test, chưa phải ghi điểm danh qua UI/DB.
- Withdrawal policy đã kiểm đúng 70% được hoàn 80% giá trị chưa dùng, dưới 70% rút không hoàn, hết buổi không được gửi; không thay thế kiểm snapshot từ lúc gửi tới duyệt trễ.
- Scheduler test chỉ kiểm xử lý tiếp khi một Run lỗi và phục hồi cursor bằng mock; không chứng minh completion/chi hoàn thường trên DB.
- Đã thử CourseWithdrawalIntegrationTests: không khởi tạo được vì `Could not find a valid Docker environment`. Tổng Maven ghi 34 lượt, 0 assertion failure, 1 initialization error; toàn lệnh BUILD FAILURE. Không tính các method integration là pass hoặc đã thực thi.
- Source có integration test cho approvalUsesRequestTimeSnapshotEvenAfterAnotherUnitStarts, validRequestCanBeApprovedAfterRunCompletes, cancellationApprovalAndRejectionCompeteInRealTransactions, retry cancel và rollback snapshot/audit. Các nhóm CoachSession/RefundObligation/RunClosure/ScheduleChange/Order integration cũng cần PostgreSQL Testcontainers. Cần môi trường Docker hoạt động để kiểm tiếp giao dịch thật; không thay datasource sang DB local đang dùng để tránh test ghi/xóa dữ liệu đó.
- Log: C:/Users/trloc/AppData/Local/Temp/course-gap-followup-tests.log. Không sửa source BE; git status BE giữ nguyên thay đổi có sẵn. Đây là giới hạn môi trường kiểm thử, chưa phải gap nghiệp vụ mới.

### Manager recon Course — Chrome DevTools MCP, 03/11/2026

FE d6fe111, BE source 09215bd. Lúc đầu runtime cũ trả 404 NOT_FOUND/No static resource cho /course-payments/reconciliation-queue. Đã restart tiến trình local cổng 8080 từ source mới; API mới trả 200. Không sửa source BE/.env; checksum QR chỉ giữ trong environment runtime.

- Fixture tạo qua Manager API: QA-RECON-1793698603440, 1 buổi 20/11/2026 09:00–10:00 (+07), capacity 2, tuition 1.000 VND. Member MB-100024 tạo đơn và QR qua UI.
- Đơn COR-7BF2D5FD7DAD4A30848C20362814F85E; payment 95f96e14-3ec6-427f-aa15-4dfd7343c8f2. Chứng từ ghi rõ QA simulated/no real money; không chuyển tiền thật.
- Manager UI tìm theo mã đơn: PASS; queue có đúng tên/mã hội viên, amount và deadline. Detail trả canConfirmPaid true, canConfirmFailed false.
- Nhập 999 thay vì 1.000 VND rồi submit UI: HTTP 400; FE hiển thị thông báo kiểm tra tiền/nội dung/chứng từ, cho sửa lại.
- Sửa đúng 1.000 và submit UI: HTTP 200; payment PAID, order PAID, reservation ENROLLED, có enrollment. UI báo Đã thanh toán/Hệ thống đã ghi nhận đăng ký; queue tự tải lại, tìm mã đơn trả 0 dòng.
- Member chủ sở hữu đọc result 200 PAID; trang Khóa học của tôi hiện đúng Run, Đang theo học/Đã thanh toán 1.000 VND; API trả đúng một enrollment ACTIVE và method SEPAY.
- Kết luận: G15 luồng Manager xác nhận Course còn hạn PASS UI + API trên runtime mới. Không còn tái hiện PAYMENT_NOT_FOUND của luồng cũ.
- Lượt này chưa tái kiểm runtime nhánh FAILED/hết hạn, timeout/replay/concurrency và Member khác; hai test UI mock trước đó không thay cho các ca runtime này. Không kết luận toàn bộ payment regression đã pass.

### Manager recon — edge cases trên runtime thật, 03/11/2026

FE d6fe111, BE 09215bd. Dùng Chrome DevTools MCP; chỉ dữ liệu QA, chứng từ simulated, không chuyển tiền thật. Bảng này bổ sung/thay trạng thái chưa kiểm của lượt Manager recon phía trên; không xóa lịch sử lỗi cũ.

| Ca | Kết quả và phạm vi |
|---|---|
| Member khác đọc kết quả thanh toán của MB-100024 | PASS API: Member MB-100019 nhận 403 PAYMENT_FORBIDDEN |
| Dùng lại mã giao dịch ngân hàng cho đơn khác | PASS API: mã QA-RECON-20261103-7BF2D5FD đã dùng bị từ chối 409 PAYMENT_CONFLICT |
| Đơn hết hạn đã được scheduler xử lý | PASS API: đơn COR-BA565AC336B042599FE1A46D3B96CB67 FAILED; không cho ép PAID hoặc quyết định FAILED mới, trả 409 |
| Hai nhân viên đối soát cùng đơn/cùng giao dịch đồng thời | PASS API: Manager + Reception, hai key khác nhau, cả hai 200 với cùng kết quả; COR-C814361641A5484FB287C970678B39ED PAID, Member MB-100019 có đúng một enrollment ACTIVE cho Run |
| Replay sau thành công | PASS API: gửi lại cùng key hai lần và key mới với cùng giao dịch đều 200, cùng enrollment |
| FE mất phản hồi sau khi BE commit rồi thử lại | PASS UI + API: COR-8CD97EA11AFF4A099DC3B1B17BAE7F42; interceptor một lần bỏ response thành công trước khi tới UI (không ngắt mạng thật), FE báo chưa xác định kết quả, khóa dữ liệu và cho thử lại. Nút thử lại gửi đúng cùng key/payload, trả PAID/cùng enrollment; UI báo thành công, MB-100024 có đúng một enrollment cho Run |
| Ghi FAILED thủ công sau hết hạn, trước scheduler | PASS API: COR-98D577AEBE314CB0B41517E4ACE7E00A; detail canConfirmPaid=false, canConfirmFailed=true; POST FAILED 200, reservation EXPIRED, enrollment=null |

Fixture bổ sung: QA-EXPIRY-1793702029031 (22/11), QA-RACE-1793702032260 (23/11; hai Member đã thanh toán QA 1.000 VND/người), Run QA-FAIL có buổi 24/11 và đơn FAILED. Không sửa đồng hồ hoặc ghi DB trực tiếp.

Giới hạn: nhánh FAILED mới kiểm qua API, chưa thao tác nút FAILED trên UI runtime. Response-loss là giả lập ở lớp client sau response thật, không phải cắt mạng vật lý. Race kiểm cùng payment/cùng provider transaction; chưa chứng nhận mọi interleaving, hai provider transaction khác nhau, trùng transaction xuyên Membership/Course, số audit/notification trong DB hoặc restart giữa giao dịch. Chưa phát hiện lỗi mới trong các ca đã kiểm; không đồng nghĩa toàn bộ Course regression đã hoàn tất. Không sửa source BE/FE, không commit hai tài liệu.

### Kiểm tiếp recon và điều kiện integration — 03/11/2026, 18:24–18:34 (+07)

- PASS 16 unit/policy test: CourseReconciliationValidationTests (2), CourseAttendancePolicyTests (7), CourseWithdrawalPolicyTests (5), CourseRefundStateMachineTests (1), CourseRunClosureSchedulerTests (1). BUILD SUCCESS; log C:/Users/trloc/AppData/Local/Temp/course-followup-validation.log. Không tính các test này là E2E DB.
- PASS UI offline/retry: COR-5D58A8B3BDD24C7E93F8C7D6818032ED. Chrome DevTools Offline trước submit khiến FE báo không xác nhận được kết quả và giữ dữ liệu; bỏ Offline, bấm thử lại => PAID, UI thành công. Đây là chặn mạng tại trình duyệt, không tắt mạng hệ điều hành hoặc kill BE giữa transaction.
- PASS API race hai mã giao dịch khác nhau: Manager/Reception cùng đối soát COR-49F285FC43224D28B51D77AECB8560E2 => một 200 PAID, một 409 PAYMENT_CONFLICT; MB-100024 có đúng một enrollment cho Run QA-OFFLINE (25/11).
- PASS UI xử lý scheduler thắng race: COR-ACCFE32CAF244A889914EA936FAA5F5F (26/11) được scheduler expire trước POST FAILED; FE hiện thông báo conflict, bấm Kiểm tra lại kết quả => Đã ghi nhận thất bại. Đây không phải lỗi.
- PASS submit FAILED qua form thật: COR-4105E3B215564945B1241549E936DF8D (27/11), payment 9a1b99b1-013a-4c37-98f0-086f7ca4a45c. Điền form bằng Chrome MCP; JavaScript hẹn click nút Kiểm tra lại kết quả rồi Xác nhận đối soát ngay sau deadline để bắt cửa sổ trước scheduler, không sửa API response/đồng hồ. Network reqid 8821 POST 200, GET result FAILED, UI Đã ghi nhận thất bại, audit COURSE_PAYMENT_RECONCILED đúng một bản ghi.
- PASS kiểm audit và notification qua API thật cho ba fixture: qaPaymentrace (cùng transaction đồng thời), qaLostPayment (bỏ phản hồi sau commit và retry), qaOfflineFixture (Offline/retry). Mỗi payment có đúng một audit COURSE_PAYMENT_RECONCILED; mỗi order có đúng một notification COURSE_ENROLLMENT_CREATED sau đọc đủ các trang notification của Member. Đây là xác minh qua API, không truy vấn DB trực tiếp hoặc chứng minh mọi lỗi rollback.
- Integration vẫn BLOCKED môi trường: chạy PaymentFlowIntegrationTests#concurrentStaffCourseReconciliationSerializesKeysAndProviderClaims thất bại lúc khởi tạo Testcontainers: Could not find a valid Docker environment (1 initialization error, chưa thực thi assertion). Không có docker trên PATH và không có binary ở đường dẫn Docker Desktop mặc định. Log C:/Users/trloc/AppData/Local/Temp/course-followup-integration.log.
- Chưa hoàn tất: trùng transaction xuyên Membership/Course; webhook/cash/expiry tranh chấp trong mọi thứ tự; rollback audit/outbox; crash/restart giữa transaction; E2E điểm danh đúng giờ, snapshot rút 7/10 rồi duyệt ở 6/10/sau kết thúc, completion tự động và hoàn thường sau completion. Source có nhiều integration test tương ứng trong PaymentFlowIntegrationTests, CourseWithdrawalIntegrationTests, CourseRefundObligationIntegrationTests và CourseRunClosureIntegrationTests; cần Docker/PostgreSQL test riêng để chạy, không đổi datasource test sang DB Supabase đang dùng. Không kết luận các mục chưa chạy là lỗi BE.
- Không sửa source FE/BE, không commit hai tài liệu; browser đã trở lại Online và phiên Manager.

## BÀN GIAO QA CHƯA XÁC MINH — gửi BE/team có Docker (03/11/2026)

Đây là danh sách cần kiểm thử, KHÔNG phải danh sách lỗi đã tái hiện. Baseline đã kiểm: FE d6fe111, BE 09215bd. Các mục chưa kiểm trong lịch sử phía trên phải đối chiếu mục bàn giao này và kết quả mới nhất; FAILED UI, browser Offline/retry, race hai mã giao dịch và audit/notification qua API đã pass, không còn là ca hoàn toàn chưa test.

### Chạy integration test trên PostgreSQL Testcontainers

Bật Docker engine/Linux containers, dùng JDK 21 và Maven theo pom.xml. `docker info` phải thành công. Testcontainers dùng postgres:17; cho phép tải image/dependency nếu máy chưa cache. Chỉ dùng DB container riêng do test tạo; không chuyển test sang DB Supabase/local nghiệp vụ vì fixture có ghi/xóa dữ liệu và thay constraint để kiểm rollback.

Chạy trong repository backend:

```powershell
docker info
mvn "-Dtest=PaymentFlowIntegrationTests,CourseWithdrawalIntegrationTests,CourseRefundObligationIntegrationTests,CourseRunClosureIntegrationTests,CourseCoachSessionIntegrationTests" test
```

Lệnh trên là bộ test có sẵn cần chạy tiếp, chưa được xác nhận PASS trên máy hiện tại. Lượt gần nhất dừng ở khởi tạo Docker (1 error); không coi là assertion fail của nghiệp vụ, cũng không coi là test pass. Không dùng skipTests để báo hoàn tất.

### Checklist còn mở và kết quả cần chứng minh

| Mục | Cần kiểm / tiêu chí đạt | Điểm bắt đầu trong test hiện có |
|---|---|---|
| QA-01 — Mã giao dịch xuyên Course/Membership | Một provider transaction chỉ thanh toán một đơn trên toàn hệ thống; kiểm cả hai chiều và cạnh tranh đồng thời; đơn bị từ chối không phát sinh quyền học/gói tập | PaymentFlowIntegrationTests: manualCourseTransactionCannotBeReusedByMembershipOrAnotherCourse, courseWebhookTransactionCannotBeReusedByManualMembershipReconciliation, manualMembershipReconciliationTransactionCannotFulfillCourse, concurrentMembershipReconciliationAndCourseWebhookShareProviderClaim |
| QA-02 — Race với webhook/cash/expiry | Manual recon cạnh tranh webhook hoặc cash; expiry cạnh tranh FAILED; đúng một kết quả nghiệp vụ, không deadlock, không trùng enrollment/audit/notification, không hồi sinh reservation hết hạn | PaymentFlowIntegrationTests: concurrentCourseReconciliationAndWebhookOnlyFulfillOnce, concurrentCourseCashAndReconciliationDoNotDuplicateEnrollment, concurrentCourseExpiryAndFailedReconciliationExpireOnlyOnce |
| QA-03 — Rollback và replay trong DB | Cố ý làm audit/outbox/allocation thất bại: toàn bộ transaction rollback, không payment PAID mà thiếu enrollment; retry sau bỏ lỗi tạo đúng một bộ artifact. Kiểm same key/different payload bị 409 | PaymentFlowIntegrationTests: courseReconciliationAuditFailureRollsBackTheEntireDecision, courseWebhookAuditFailureRollsBackEventAndEveryFulfillmentArtifact, courseWebhookOutboxFailureRollsBackEventAndEveryFulfillmentArtifact; các assertion DB trong suite |
| QA-04 — Crash/restart giữa transaction | Trên instance/DB QA riêng, dừng tiến trình trước commit và sau commit trước response; khởi động lại, GET result rồi retry cùng key/payload; chỉ có rollback toàn bộ hoặc một quyết định đã commit, không ghi dở/trùng | Cần test/harness riêng; chưa xác nhận suite hiện có mô phỏng kill/restart thật. Offline browser và bỏ response tại client KHÔNG thay thế ca này |
| QA-05 — Quyền điểm danh và cửa sổ giờ | Ghi/đọc attendance qua API/DB đúng giờ; trước/sau cửa sổ, sai assignment, Run không hoạt động, pending withdrawal bị chặn; course-only không nhận quyền gym | CourseWithdrawalIntegrationTests: courseOnlyCheckInAndAttendancePersistThroughApiWithTimeAndAssignmentGuards, attendanceApiCannotWriteForInactiveRunEvenInsideSessionWindow, pendingWithdrawalSuspendsRosterAndAttendance; CourseCoachSessionIntegrationTests |
| QA-06 — Snapshot rút và duyệt trễ | Gửi khi còn 7/10 được chốt hoàn 80% giá trị còn lại; duyệt lúc 6/10 hoặc sau kết thúc vẫn dùng snapshot lúc gửi. Gửi mới ở 6/10 rút không hoàn; kiểm cancel/reject/approve cạnh tranh, giữ/trả slot và quyền học đúng rule | CourseWithdrawalIntegrationTests: pendingKeepsCapacityAndExactSeventyPercentApprovalCreatesFlooredRefund, belowSeventyPercentStillWithdrawsWithZeroRefundObligation, approvalUsesRequestTimeSnapshotEvenAfterAnotherUnitStarts, validRequestCanBeApprovedAfterRunCompletes, cancellationApprovalAndRejectionCompeteInRealTransactions |
| QA-07 — Tự hoàn tất Run và chi hoàn thường | Kiểm scheduler thực sự chuyển Run qua các trạng thái kết thúc, không chỉ gán COMPLETED trong fixture. Hoàn thường trước COMPLETED bị chặn, sau COMPLETED mới chi/xác minh; chạy scheduler/retry nhiều lần không tạo trùng. Phân biệt hoàn hủy Run/lỗi thanh toán/chênh lệch được chi sau Manager duyệt | CourseRunClosureIntegrationTests kiểm đóng đăng ký/hủy; CourseRefundObligationIntegrationTests: disbursementRequiresCompletionExceptForImmediateSourcesWithoutMutatingRejectedRefunds, ineligibleDisbursementHttpConflictDoesNotMutateRefund. Phải bổ sung/kiểm E2E completion scheduler nếu suite chỉ seed trạng thái COMPLETED |

### Gửi lại kết quả cho FE

Với mỗi QA-01..07: ghi PASS / FAIL / BLOCKED / NOT RUN, commit BE, tên test hoặc bước tái hiện, expected/actual, HTTP status/error code và log liên quan. Đính kèm Maven summary cùng target/surefire-reports (XML/TXT), số test thực chạy/skip/error. Với race/crash, gửi số payment/enrollment/audit/notification trước/sau và cách tái hiện; không gửi token, mật khẩu, .env hoặc connection string. Với lỗi ảnh hưởng contract FE, nêu endpoint/request/response/state transition thay đổi. Nếu method test chưa bao phủ đủ tiêu chí, ghi rõ phần còn thiếu, không coi cả checklist pass chỉ vì Maven xanh.

Hai tài liệu COURSE_BOOKING_GAPS.md và COURSE_RUN_RESCHEDULE_HANDOFF.md vẫn để ngoài commit theo yêu cầu.
