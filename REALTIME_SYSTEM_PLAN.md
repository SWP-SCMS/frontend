# Đề xuất realtime toàn hệ thống SCMS — 03/11/2026

Trạng thái: đề xuất contract để FE/BE thống nhất, chưa phải API đã có. Phạm vi là toàn bộ luồng nghiệp vụ hiện hữu; không mở rộng quyền truy cập hiện có. Không commit tài liệu khi chưa có yêu cầu.

## Hiện trạng đã kiểm

- FE có useAutoRefresh, polling chuông thông báo, polling thanh toán và một số màn quầy; chưa thấy client SSE/WebSocket trong src.
- BE có NotificationWriter và notification outbox/dispatcher; chưa thấy endpoint SSE/WebSocket trong src/main.
- Notification lưu trữ không thay thế sự kiện thay đổi dữ liệu: không phải mutation nào cũng cần hiện thông báo cho người dùng.

## Ma trận phạm vi

| Nghiệp vụ | Thay đổi cần phát sự kiện | Màn/người nhận trong phạm vi được phép |
|---|---|---|
| Giáo án, kết quả, nhận xét | Tạo/sửa/xóa/công bố giáo án; ghi/sửa kết quả, nhận xét | Member chủ sở hữu và Coach còn assignment; draft chỉ người có quyền xem draft. Reception không được nhận nội dung/ID giáo án riêng tư |
| Phân công HLV, PT | Gán/đổi/kết thúc assignment; đổi availability; đặt/hủy PT | Member, HLV liên quan, Manager và quầy trong phạm vi API đã cho phép; thu hồi quyền HLV cũ |
| Lớp gym, lịch và phòng | Đổi lịch/phòng/coach, mở/hủy buổi, recurring schedule, capacity | Lịch Member/Coach, roster, danh sách đặt lớp và màn vận hành |
| Booking, waitlist, attendance | Đặt/hủy, mời/nhận chỗ, hết hạn giữ chỗ, điểm danh/sửa điểm danh | Member liên quan; Coach assigned; quầy/Manager có quyền; slot cập nhật trên danh sách đang mở |
| Course | Template/Run publish/archive; lịch/bù; thanh toán; enrollment; attendance; waitlist; rút/hủy rút/duyệt/từ chối; chuyển; hoàn; closure/completion | Catalog công bố, khóa của Member, lịch/roster Coach, quầy và hàng đợi Manager; Course tách quyền gym |
| Gói tập và tài chính | Offer/plan, đơn/QR/paid/expired, recon, receipt, freeze/termination/refund | Chủ đơn, màn thu/chi/duyệt, quyền lợi Member, dashboard; chỉ BE quyết định số tiền/trạng thái |
| Check-in trung tâm | Vào/ra, đóng lượt, thay đổi điều kiện vào | Quầy, Manager và thông tin của Member nếu có API |
| Tài khoản/hồ sơ | Cập nhật hồ sơ, trạng thái tài khoản, kích hoạt/email, thay quyền | Chủ tài khoản và staff được phép; phiên bị thu hồi không tiếp tục nhận stream |
| Thông báo | Tạo, đọc một/đọc tất cả | Đồng bộ chuông và trạng thái đọc giữa các tab của cùng tài khoản |
| Dashboard, báo cáo, audit | Mutation làm thay đổi chỉ số/nhật ký | Đánh dấu dữ liệu cũ và tải lại có gộp, theo quyền; báo cáo nặng không tính lại mỗi event |
| Public catalog | Công bố/sửa/ẩn gói, lớp, Course | Chỉ dữ liệu công khai; public stream riêng nếu BE hỗ trợ, nếu chưa dùng refresh khi focus/polling |

## Contract đề xuất cho BE

1. GET /api/v1/events/stream, Content-Type text/event-stream. Auth Bearer qua fetch streaming vì EventSource native không gắn Authorization tùy ý; không đưa access token lên URL. Theo cơ chế refresh token hiện có. FE gọi thẳng API backend streaming, cần kiểm CORS localhost/Vercel, heartbeat và proxy buffering/timeout thực tế Railway.
2. Envelope đề xuất: schemaVersion, eventId (cursor opaque), type (domain.changed), resourceType, resourceId, resourceVersion nếu có, occurredAt, invalidate (các topic có allowlist). resourceId dùng nội bộ, không hiển thị raw UUID. Không kèm giáo án, dữ liệu nhạy cảm hay thông tin ngân hàng.
3. Ghi event/outbox cùng transaction nghiệp vụ; phát sau commit, retry delivery, eventId ổn định để deduplicate. Không chỉ publish trong memory sau commit vì có thể mất event khi process chết. Scheduler, webhook, mutation proxy và mọi API ghi đều phải được bao phủ.
4. Server tự xác định recipients từ ownership/assignment/role và quyền trường dữ liệu. Không tin memberId/role client yêu cầu. Kiểm lại quyền khi replay, disconnect khi account/session bị thu hồi. Event không cấp thêm quyền GET; HLV mất assignment phải xóa dữ liệu cũ trên FE, Reception không xem giáo án.
5. Hỗ trợ Last-Event-ID/resume cho fetch reconnect; quy định retention. Cursor không còn hợp lệ hoặc mất khoảng sự kiện phải gửi resync-required để FE tải snapshot lại. Chốt thứ tự theo resource/version; FE không suy ra thứ tự bằng timestamp đơn thuần.
6. Multi-instance: đảm bảo event tới connection ở instance khác, không chỉ emitter local. Dùng shared broker hoặc durable event log với fan-out/cursor phù hợp; outbox dispatcher hiện có không tự chứng minh hỗ trợ fan-out.
7. Chốt đầy đủ bảng mutation -> topic -> recipients -> API snapshot. BE trả danh sách endpoint/topic được hỗ trợ và những gap còn lại; FE không tự invent endpoint hoặc gọi N+1 để bù thiếu contract.

## Thiết kế FE

- Một RealtimeProvider dùng chung dưới AuthProvider; mở stream khi đăng nhập, đóng/hủy request và xóa subscriptions khi logout/đổi account. Không mở một stream cho mỗi component; quản lý giới hạn nhiều tab.
- Event chỉ báo dữ liệu đổi, FE refetch bằng GET hiện có cho màn đang mở. Gộp burst theo topic, một request đang chạy, đánh dấu cần tải lại nếu event đến giữa request; bỏ response cũ sau đổi filter/account. Không refetch từng row.
- Tải snapshot lúc vào trang, xử lý race subscribe/snapshot bằng version/cursor hoặc refetch sau stream connected. Reconnect backoff+jitter, refresh auth, resync khi trở lại tab/online. Polling nhẹ làm fallback khi stream hỏng; không chạy polling trùng liên tục khi stream khỏe.
- Không reload toàn trang, không giật skeleton mỗi event. Không ghi đè form đang dirty; báo có bản mới, giữ dữ liệu người dùng và dùng expectedVersion/conflict khi lưu. Không tự submit hay tự xác nhận thanh toán.
- Countdown chỉ cập nhật đồng hồ, không thay thế sự kiện trạng thái. Phân biệt loading ban đầu, background refreshing, stale/disconnected và lỗi tải.

## Trình tự triển khai

1. BE/FE chốt contract, quyền và ma trận mutation; dựng stream/outbox/auth/resume/multi-instance. BE làm trước endpoint, FE không sửa BE.
2. FE provider + subscriptions dùng chung; pilot payment/recon + chuông, kiểm hai tài khoản và mất mạng.
3. Giáo án/kết quả/feedback + assignment/PT; lịch gym/booking/waitlist/attendance/check-in.
4. Course toàn vòng đời; gói tập/freeze/termination/refund, quyền lợi và tài khoản.
5. Admin catalog/config, dashboard/report/audit và public catalog theo contract được cung cấp.
6. Mỗi nhóm kiểm độc lập, commit code riêng; không đánh dấu full realtime cho tới khi ma trận không còn mutation chưa nối.

## Tiêu chí QA

- Hai browser/role: bên A lưu thành công, bên B thấy thay đổi mà không refresh, mục tiêu bình thường 1–2 giây sau commit (mục tiêu cần đo, không cam kết khi offline).
- Reconnect, refresh token, logout/account switch, nhiều tab, cursor hết hạn, duplicate/out-of-order, burst và nhiều instance không mất cập nhật hoặc rò dữ liệu.
- Rollback không phát sự kiện thành công; replay không lặp notification nghiệp vụ; reconnect tải đúng snapshot.
- Form dirty không bị reset; 403 do mất quyền xóa dữ liệu riêng tư; Member chỉ nhận của mình, HLV chỉ assigned, Reception không nhận plan/kết quả/feedback ngoài quyền.
- Kiểm thật localhost và FE Vercel -> BE Railway; đo số stream/request, latency và fallback. SSE không tự bảo đảm transport production hoạt động nếu chưa test.

## Yêu cầu bắt buộc bổ sung: Audit History Manager realtime

User xác nhận Audit History cũng phải cập nhật tức thời, không chỉ chuông thông báo. Đưa nhóm này vào pilot cùng payment/recon để kiểm ngay audit của các hành động quan trọng.

- Phạm vi: mọi hành động hiện được BE ghi AuditEvent, gồm thanh toán/hoàn tiền, duyệt/từ chối, trạng thái tài khoản, phân công, giáo án/kết quả/nhận xét, lịch/điểm danh, Course và các tác vụ scheduler/webhook. Realtime không tự tạo audit cho hành động BE chưa ghi; BE cần đối chiếu danh mục hành động quan trọng và báo gap audit riêng.
- Contract đề xuất: topic audit.created trên stream chung, chỉ ACTIVE MANAGER được nhận (cùng quyền GET /manager/audit-events). Chỉ phát khi audit đã commit; giao dịch rollback không phát audit thành công. Envelope gồm eventId, auditId, occurredAt và metadata tối thiểu cho invalidation; không đẩy beforeData/afterData, chứng từ hay thông tin riêng tư qua broadcast.
- Nguồn sự thật vẫn là audit lưu trữ append-only. Stream không thay bảng audit, không lấy notification làm nguồn dựng lịch sử. Event delivery/replay không được sinh thêm AuditEvent nghiệp vụ.
- FE tự tải lại GET /manager/audit-events theo bộ lọc đã áp dụng và số trang hiện tại; giữ nguyên form lọc đang nhập, vị trí cuộn và chi tiết đang mở. Gộp nhiều event thành một lần tải, bỏ response lỗi thời khi đổi filter; không append trực tiếp event làm sai lọc/sort/phân trang.
- Trang đầu: bản ghi mới phù hợp tự xuất hiện, cập nhật tổng số. Khi xem trang sau: giữ số trang, refetch nội dung/tổng theo API; hiển thị chỉ báo có hoạt động mới và cho quay trang đầu, không tự nhảy trang. Offset pagination có thể dịch dòng khi thêm bản ghi; nếu cần giữ chính xác tập bản ghi đang xem thì BE bổ sung cursor/snapshot, không coi page number là snapshot ổn định.
- Mất kết nối/reconnect/resync: tải lại snapshot theo filter hiện tại; hủy subscription và xóa dữ liệu khi logout/mất quyền. Không cần phát toast cho mọi audit vì dễ gây spam.
- QA bắt buộc: Manager B mở lịch sử, người dùng A tạo hành động hợp lệ -> B thấy audit trong mục tiêu 1–2 giây sau commit; đúng actor/action/target/time, đủ bộ lọc, không trùng khi retry; rollback không có audit thành công; Member/Reception/Coach không nhận audit stream; kiểm nhiều tab, token hết hạn, reconnect và burst. Phân biệt mục tiêu độ trễ với kết quả đã đo.

Trạng thái: đã bổ sung yêu cầu vào plan; BE chưa có stream trong code đã rà, FE Audit History chưa được triển khai SSE. Không sửa BE hoặc commit tài liệu.

## Kết quả rà toàn bộ source FE/BE — bổ sung phạm vi (03/11/2026)

Phạm vi rà tĩnh: AppRoutes.jsx, các page/service/hook FE, toàn bộ lớp *Controller.java và @Scheduled trong src/main/java BE; đọc sâu các luồng training, audit, quyền lợi, phòng và lifecycle. Đây là inventory/thiết kế, không phải đã triển khai hay test runtime realtime. Contract SSE ở trên vẫn là đề xuất. Không tự thêm nghiệp vụ mới từ tên event.

### Các phần cần tách rõ để không bỏ sót

| Nhóm | Tình huống phát sinh và nơi phải cập nhật | Ưu tiên |
|---|---|---|
| Nghỉ phép HLV | Coach gửi/rút/hủy; Manager duyệt/từ chối; trạng thái tự đổi theo ngày. Cập nhật queue Manager, danh sách Coach, availability, lịch và tác động tới các buổi liên quan theo kết quả BE | Ngay |
| Đóng phòng và xử lý tác động | Tạo/gia hạn suspension, đổi phòng/hủy hàng loạt; cập nhật RoomImpact, lịch gym/PT/Course, roster, lựa chọn phòng còn hợp lệ. Preview cũ phải đánh dấu hết hiệu lực, không tự apply | Ngay |
| Quyền lợi và shell Member | Kích hoạt gói, RESERVED sang ACTIVE, hết hạn/freeze/end-early/termination; cập nhật MemberAreaContext, sidebar PLUS, route guard, nút booking/PT/training/check-in và trang hiện tại. Không cấp quyền gym cho Course-only | Ngay |
| Hàng đợi phân công HLV | Membership/benefit/assignment thay đổi làm thay đổi Member cần phân công; cập nhật CoachAssignmentQueue, CoachAssignedMemberList, My Coach, lịch PT và scope quyền HLV cũ/mới | Ngay |
| Giáo án version/archive/replace | Code hiện có create ACTIVE, append version, archive và replace active atomically; cập nhật plan hiện tại, lịch sử version, modal đọc và Member. Không có endpoint publish/delete/restore giáo án trong controller đã rà; dòng tổng quan trước chỉ là ví dụ, phạm vi thực tế theo các hành động này | Ngay |
| Training theo buổi và theo Member | SessionTrainingResult/SessionTrainingFeedback khác controller với TrainingResult/TrainingFeedback; cả hai phải làm mới màn Coach theo buổi và lịch sử Member, không chỉ màn giáo án | Ngay |
| Kích hoạt thủ công, email, hồ sơ | Quầy tạo yêu cầu -> Manager queue; approve/reject -> quầy/chủ tài khoản. Đổi email/verify/cancel và ảnh đại diện -> profile/header các tab. Luồng chưa đăng nhập không được mở stream Manager hoặc stream theo email tùy ý; cần ticket/session giới hạn nếu muốn push trước login, nếu thiếu contract dùng status refresh | Ngay theo quyền |
| Khóa tài khoản/reset mật khẩu/session | Status đổi, reset/change password hoặc logout làm thu hồi phiên theo policy BE thì stream phải dừng và FE xử lý auth. Không giả định mọi change-password đều revoke cùng cách; xác nhận policy hiện hành. Không broadcast mật khẩu/token/OTP | Ngay |
| Check-in và checkout hai chiều | Member tự checkout -> OpenCenterVisits và quầy khác tự mất lượt; quầy checkout -> dashboard Member; đổi gói/quyền hoặc khóa account -> điều kiện check-in phải tải lại | Ngay |
| Hàng đợi nhiều nhân viên | Manager A duyệt/Reception A chi thì queue/modal của B phải phản ánh đã xử lý, disable hành động lỗi thời hoặc yêu cầu tải lại; server vẫn kiểm state/version. Áp dụng activation, leave, membership request, refund, recon, Course workflow | Ngay |
| Order/payment/receipt nhiều nơi | QR tạo/expire/paid/failed/cancel, cash, webhook, recon; đồng bộ Member checkout, màn quầy, danh sách receipt, lịch sử gói, quyền lợi và chỉ số. Không chỉ cập nhật trang QR | Ngay |
| Course chuyển/hoàn nhánh phụ | Offer hết hạn, giữ chỗ chuyển được giải phóng, đơn bù chênh lệch thanh toán, refund fail/return/verify, hủy Run và buổi chưa có makeup; cập nhật cả Run nguồn/đích, waitlist, roster, enrollment, quyền điểm danh và refund eligibility | Ngay |
| Slot, waitlist và số chỗ trên catalog | Người khác booking/cancel/hold/payment/transfer/expiry phải làm mới availability người đang xem cùng lớp/Run; không gửi thông tin danh tính người đặt cho người xem catalog | Ngay |
| Danh mục và form chọn dữ liệu | Bộ môn/benefit, plan/offer, lớp, phòng, Coach profile/status, Course publish/deactivate/archive; cập nhật list/detail và options trong form đang mở. Giữ dữ liệu đang nhập, đánh dấu lựa chọn không còn hợp lệ; không tự chọn thay người dùng | Làm mới theo event |
| Dashboard/báo cáo/audit | Member, Coach, Reception, Manager đều có dashboard. Map dependency từ payment/enrollment/attendance/visit/assignment/leave/refund; báo cáo giữ filter/time range và gộp refresh; audit yêu cầu riêng phía trên | Ngay audit; gộp báo cáo |
| Thông báo giữa tab | Notification mới và mark-read/read-all đồng bộ badge/list giữa các tab; event dữ liệu không bắt buộc tạo notification. Reconnect không tạo toast lặp | Ngay |

### Nguồn thay đổi ngoài thao tác nút

BE phải phát invalidation tại transaction thực sự thay đổi trạng thái, không chỉ trong controller:

- CourseReservationExpiryScheduler, CourseWaitlistScheduler, CourseTransferExpiryScheduler, CourseRunClosureScheduler, CourseSessionDisruptionScheduler.
- MembershipLifecycleScheduler: expire/kích hoạt gói kế tiếp và thực thi freeze/termination theo service thực tế.
- SessionLifecycleScheduler/SessionLifecycleService: SCHEDULED -> IN_PROGRESS -> COMPLETED, waitlist hết hiệu lực, insert ABSENT tự động. Các cập nhật SQL bulk phải xác định được phạm vi bị tác động để fan-out; listener save entity đơn thuần không bao phủ.
- CoachLeaveLifecycleScheduler, WaitlistPromotionScheduler; webhook SePay; các thao tác Reception làm hộ.
- Read-triggered lifecycle: CourseOrderService có expireReservation khi đọc đơn hết hạn; PaymentService/MembershipOrderService có gọi membership lifecycle. Nếu GET làm phát sinh chuyển trạng thái đã commit thì cần event, nhưng GET không đổi dữ liệu không được phát event gây vòng lặp refetch.
- NotificationOutboxDispatcher hiện mặc định quét 10 giây; nếu nối realtime sau dispatcher này thì không thể mặc nhiên cam kết 1–2 giây sau business commit. BE cần cơ chế đánh thức/dispatch đáp ứng mục tiêu và đo latency; tách thời gian scheduler phát hiện hạn khỏi thời gian truyền SSE sau commit.
- EmailOutboxDispatcher: không cần gửi nội dung email qua SSE. Chỉ phát trạng thái delivery cho màn/người có contract và quyền xem, không tự tạo UI theo dõi mail mới.

### Cần sửa rõ cách triển khai trước đó

- Giáo án chỉ có create/version/archive/replace như source hiện tại; không bổ sung workflow công bố/xóa chỉ để phục vụ realtime.
- CoachAvailabilityController hiện là GET dữ liệu dẫn xuất; event phát từ lịch/leave/assignment/account, không invent mutation availability riêng.
- Audit event chỉ tới Manager; dữ liệu giáo án/result/feedback vẫn theo endpoint ownership/assignment/benefit hiện có, không mặc định Manager/Reception được xem nội dung riêng tư.
- Đồng hồ đếm ngược, thời điểm mở đăng ký/đóng cửa sổ thao tác có thể đổi dù chưa có row update. Payload deadline + server time và refetch tại mốc/focus vẫn cần; không dùng SSE thay timer hay tự quyết định trạng thái tài chính ở FE.
- Khi event tới lúc modal đang busy/dirty: ghi nhận pending invalidation; tải khi mutation xong/đóng modal, hiển thị bản ghi đã thay đổi; không bỏ event rồi để UI cũ vô hạn.
- Không đặt provider vào layout remount theo từng route Member. Đặt dưới AuthProvider nhưng phía trên route/layout để giữ một stream trong SPA, và bảo đảm xử lý multi-tab/HTTP connection limits.

### Không cần event riêng hoặc không được tự động thay đổi

- Nhập từng ký tự, validation RHF/Zod, toggle UI, chuyển tab, thao tác tìm kiếm/lọc không ghi nghiệp vụ: xử lý local.
- POST preview (room impact/cancellation preview) không áp dụng dữ liệu: không phát sự kiện thay đổi nghiệp vụ chỉ vì HTTP method là POST. Dữ liệu nguồn đổi thì đánh dấu preview cần tính lại.
- PDF/biên lai đã xuất, báo cáo đã tải xuống, bản in: là snapshot, không sửa file tự động. Chỉ cập nhật màn nguồn/báo bản mới.
- Trang login/reset-password/OTP: không broadcast trạng thái xác thực theo email; chỉ UI tiến trình của chính request và contract session/ticket được cấp quyền.
- Trang 403/404 và nội dung tĩnh không cần subscription nghiệp vụ.

### Định nghĩa hoàn tất full realtime

Mỗi nhóm phải có bảng producer (API + scheduler + webhook + read-triggered transition) -> topic -> recipient -> GET snapshot -> consumer FE -> case QA. Bao phủ cả list/detail/modal/context/options/dashboard, không chỉ một màn đại diện. Nhóm chưa có quyền/endpoint snapshot hoặc event phải ghi gap. Không có SSE endpoint hiện tại nên các mục này chưa được đánh dấu implemented.
