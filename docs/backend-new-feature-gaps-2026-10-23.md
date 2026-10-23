# Backend gaps phát hiện khi kiểm thử tính năng mới

Ngày bắt đầu: 2026-10-23  
Mục đích: tổng hợp các thiếu sót backend được phát hiện trong quá trình FE đồng bộ và kiểm thử những workflow mới.

## Quy ước trạng thái

- `OPEN`: đã xác nhận thiếu ở backend, chưa xử lý.
- `BE IN PROGRESS`: backend đang thực hiện.
- `READY FOR FE`: backend đã có contract/code, FE cần đồng bộ hoặc kiểm thử.
- `DONE`: đã hoàn thành và kiểm thử đạt.
- `EXCLUDED`: thống nhất không thực hiện.

---

## NEW-BE-GAP-001 — Chưa thể rút yêu cầu đóng băng gói tập

**Trạng thái:** `OPEN`  
**Liên quan:** MF-006 — Membership freeze request workflow

### Hiện trạng

Backend đã hỗ trợ:

- Hội viên/lễ tân tạo yêu cầu đóng băng.
- Hội viên/lễ tân xem danh sách yêu cầu.
- Quản lý duyệt hoặc từ chối.
- Lễ tân thu phí tiền mặt cho yêu cầu đã được duyệt.

Backend chưa có API để hội viên rút yêu cầu đóng băng đang chờ duyệt. FE vì vậy chưa thể cung cấp thao tác **Rút yêu cầu** tương tự luồng hủy gói tập.

### Contract cần bổ sung

```http
DELETE /api/v1/members/me/membership-freeze-requests/{requestId}
Authorization: Bearer <member-access-token>
```

Kết quả thành công:

```http
204 No Content
```

### Business rules

1. Chỉ chính hội viên sở hữu yêu cầu mới được rút.
2. Chỉ cho rút khi yêu cầu đang ở trạng thái `PENDING`.
3. Không cho tự rút khi yêu cầu đã là `APPROVED_PENDING_PAYMENT`, `SCHEDULED` hoặc `REJECTED`.
4. Rút yêu cầu chuyển trạng thái sang `WITHDRAWN`, không xóa bản ghi vật lý.
5. Sau khi rút, hội viên được phép tạo yêu cầu đóng băng mới nếu vẫn đáp ứng điều kiện.
6. Ghi audit event, đề xuất tên `MEMBERSHIP_FREEZE_WITHDRAWN`.
7. Gọi lại endpoint khi yêu cầu không còn `PENDING` phải bị từ chối và không làm thay đổi dữ liệu.

### Thay đổi model/contract

Bổ sung `WITHDRAWN` vào `MembershipFreezeRequestStatus` và OpenAPI enum:

```text
PENDING
APPROVED_PENDING_PAYMENT
SCHEDULED
REJECTED
WITHDRAWN
```

Error codes đề xuất:

- `MEMBERSHIP_FREEZE_NOT_FOUND`: không tìm thấy hoặc yêu cầu không thuộc hội viên hiện tại.
- `MEMBERSHIP_FREEZE_INVALID_TRANSITION`: yêu cầu không còn ở trạng thái được phép rút.

### Acceptance criteria

- Hội viên rút được yêu cầu `PENDING` của chính mình và nhận `204`.
- Yêu cầu sau khi rút xuất hiện trong lịch sử với trạng thái `WITHDRAWN`.
- Hội viên có thể tạo yêu cầu mới sau khi yêu cầu trước đã được rút.
- Không thể rút yêu cầu của hội viên khác.
- Không thể rút yêu cầu ở trạng thái `APPROVED_PENDING_PAYMENT`, `SCHEDULED` hoặc `REJECTED`.
- Hai request rút đồng thời không gây cập nhật sai trạng thái; chỉ một request được thực thi thành công.
- Có audit event cho thao tác rút.

### FE follow-up sau khi BE hoàn thành

- Thêm hàm gọi endpoint rút yêu cầu freeze.
- Hiển thị nút **Rút yêu cầu** tại dòng có trạng thái `PENDING`.
- Dùng modal xác nhận trước khi rút.
- Hiển thị nhãn `Đã rút` cho trạng thái `WITHDRAWN`.

---

## Các gap tiếp theo

Thêm mỗi gap mới thành một mục `NEW-BE-GAP-XXX`, giữ nguyên cấu trúc:

1. Trạng thái và tính năng liên quan.
2. Hiện trạng quan sát được.
3. Contract cần bổ sung hoặc thay đổi.
4. Business rules.
5. Acceptance criteria.
6. FE follow-up.

---

## NEW-BE-GAP-002 — Danh sách yêu cầu gói thiếu thông tin nhận diện hội viên

**Trạng thái:** `OPEN`  
**Liên quan:** MF-001, MF-006 — màn duyệt yêu cầu của Manager

### Hiện trạng

Hai API danh sách của Manager chỉ trả `memberAccountId` dạng UUID:

- `GET /api/v1/manager/membership-termination-requests`
- `GET /api/v1/manager/membership-freeze-requests`

Manager cần thấy tên và mã hội viên để nhận diện người gửi. FE hiện phải gọi thêm `GET /manager/members/{memberAccountId}` cho từng UUID, gây N+1 request.

### Contract đề xuất

Bổ sung trực tiếp vào mỗi phần tử response:

```json
{
  "memberAccountId": "uuid",
  "memberId": "MB-100001",
  "memberFullName": "Nguyễn Văn A"
}
```

### Acceptance criteria

- Hai API danh sách trả `memberId` và `memberFullName` tương ứng với `memberAccountId`.
- Dữ liệu là snapshot hiển thị hoặc join read-only, không làm thay đổi business rules của yêu cầu.
- FE tải mỗi danh sách bằng một request, không cần gọi API chi tiết cho từng hội viên.

---

## NEW-BE-GAP-003 — Cho phép duyệt nghỉ khi Coach vẫn còn buổi tập bị ảnh hưởng

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008 — Coach leave approval flow

### Hiện trạng

Khi Manager duyệt một yêu cầu nghỉ, backend chuyển yêu cầu sang `APPROVED` ngay cả khi response vẫn còn `affectedSessionIds`.

Điều này tạo trạng thái không nhất quán: Coach đã được duyệt nghỉ nhưng vẫn đang được phân công phụ trách các buổi tập nằm trong khoảng nghỉ. Manager chỉ được nhắc xử lý các buổi bị ảnh hưởng sau khi đơn đã được duyệt.

### Contract cần điều chỉnh

Giữ nguyên endpoint:

```http
PATCH /api/v1/manager/coach-leave-requests/{requestId}/approve
```

Tại thời điểm duyệt, backend phải kiểm tra lại các session đang hoạt động chồng với khoảng nghỉ của Coach. Nếu vẫn còn session bị ảnh hưởng, từ chối thao tác:

```http
409 Conflict
Content-Type: application/problem+json

{
  "code": "COACH_LEAVE_HAS_AFFECTED_SESSIONS",
  "detail": "Resolve all affected sessions before approving this leave request.",
  "affectedSessionIds": ["uuid"]
}
```

### Business rules

1. Manager vẫn xem được `affectedSessionIds` khi yêu cầu đang `PENDING` để xử lý trước.
2. Manager phải phân công Coach khác, dời lịch hoặc hủy toàn bộ session bị ảnh hưởng trước khi duyệt đơn nghỉ.
3. Backend phải truy vấn và kiểm tra lại session trong transaction duyệt; không tin vào danh sách cũ mà FE đang hiển thị.
4. Chỉ chuyển yêu cầu từ `PENDING` sang `APPROVED` khi không còn session đang hoạt động chồng với khoảng nghỉ.
5. Nếu còn session bị ảnh hưởng, yêu cầu tiếp tục ở trạng thái `PENDING` và không ghi audit event duyệt thành công.
6. Luồng từ chối đơn nghỉ không phụ thuộc vào `affectedSessionIds`.
7. Các thao tác tạo mới hoặc phân công lại session sau khi đơn đã `APPROVED` vẫn phải bị chặn nếu Coach nghỉ trong khoảng thời gian đó.

### Acceptance criteria

- Đơn `PENDING` có ít nhất một session bị ảnh hưởng không thể được duyệt và trả `409 COACH_LEAVE_HAS_AFFECTED_SESSIONS`.
- Response lỗi trả danh sách session hiện còn phải xử lý.
- Sau khi phân công lại, dời hoặc hủy tất cả session liên quan, Manager duyệt được đơn.
- Việc kiểm tra và chuyển trạng thái được thực hiện nhất quán trong cùng transaction.
- Hai thao tác duyệt/phân công đồng thời không thể tạo trạng thái Coach đã nghỉ nhưng vẫn phụ trách session trong khoảng nghỉ.
- Manager vẫn có thể từ chối đơn dù đang có session bị ảnh hưởng.

### FE follow-up sau khi BE hoàn thành

- Khóa nút **Duyệt** khi response hiện tại còn `affectedSessionIds`.
- Hiển thị hướng dẫn Manager xử lý từng buổi trước khi duyệt.
- Khi BE trả `COACH_LEAVE_HAS_AFFECTED_SESSIONS`, cập nhật lại danh sách session từ response và giữ modal mở.
- Cho phép duyệt sau khi tải lại và danh sách `affectedSessionIds` đã rỗng.

---

## NEW-BE-GAP-004 — Chưa có API tra cứu Coach khả dụng khi phân công buổi tập

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008, US23 — xử lý session bị ảnh hưởng bởi lịch nghỉ Coach

### Hiện trạng

Khi Manager đổi Coach phụ trách một session, FE hiện chỉ có thể tải toàn bộ tài khoản Coach đang `ACTIVE` qua API danh sách nhân viên. FE không biết Coach nào thực sự rảnh trong khoảng thời gian của session.

Manager vì vậy phải chọn Coach theo kiểu thử-sai; chỉ sau khi gửi thao tác cập nhật thì backend mới kiểm tra và từ chối nếu Coach có session khác hoặc lịch nghỉ chồng giờ.

API `/manager/coach-assignments/candidates` hiện phục vụ phân công Coach cá nhân cho Member, không phản ánh khả dụng theo khoảng thời gian của session và không thể tái sử dụng cho workflow này.

### Contract cần bổ sung

Đề xuất endpoint theo session đang cần phân công lại:

```http
GET /api/v1/manager/class-sessions/{sessionId}/available-coaches
Authorization: Bearer <manager-access-token>
```

Response:

```json
[
  {
    "coachAccountId": "uuid",
    "fullName": "Nguyễn Văn A",
    "phone": "0900000000"
  }
]
```

Endpoint dùng `startTime` và `endTime` hiện tại của session, đồng thời loại trừ chính `sessionId` khỏi phép kiểm tra overlap.

Nếu cần hỗ trợ cả màn tạo mới hoặc dời lịch, có thể cung cấp thêm endpoint tổng quát:

```http
GET /api/v1/manager/coaches/availability
    ?startTime=<ISO-8601-instant>
    &endTime=<ISO-8601-instant>
    &excludeSessionId=<optional-uuid>
```

### Business rules

1. Chỉ trả Coach có tài khoản `ACTIVE`.
2. Coach không được có session đang hoạt động khác chồng với khoảng thời gian cần phân công.
3. Coach không được có kỳ nghỉ `APPROVED` chồng với khoảng thời gian cần phân công.
4. Khi sửa một session, phải loại trừ chính session đó khỏi kiểm tra trùng lịch.
5. Nếu domain có giới hạn Coach theo bộ môn hoặc loại lớp thì danh sách phải áp dụng cùng rule với thao tác phân công chính thức.
6. Kết quả discovery chỉ hỗ trợ UX; backend vẫn phải kiểm tra lại toàn bộ điều kiện trong transaction cập nhật session để chống race condition.
7. Danh sách nên có thứ tự ổn định, đề xuất theo `fullName` rồi `coachAccountId`.

### Acceptance criteria

- Manager tải được danh sách Coach khả dụng cho một session bằng một request.
- Coach đang dạy session khác trùng giờ không xuất hiện trong danh sách.
- Coach có lịch nghỉ `APPROVED` trùng giờ không xuất hiện trong danh sách.
- Coach `INACTIVE` không xuất hiện trong danh sách.
- Coach hiện đang phụ trách chính session được sửa không bị xem là xung đột với chính mình.
- Sau khi lịch Coach thay đổi, gọi lại endpoint trả kết quả mới nhất.
- Hai Manager thao tác đồng thời không thể tạo lịch trùng vì mutation vẫn kiểm tra lại availability.

### FE follow-up sau khi BE hoàn thành

- Thay nguồn dữ liệu dropdown Coach tại màn phân công lại bằng API availability.
- Hiển thị tên và số điện thoại để Manager nhận diện Coach.
- Khi thay đổi thời gian session, tải lại danh sách theo khoảng giờ mới.
- Nếu mutation vẫn trả lỗi do availability vừa thay đổi, thông báo Coach không còn khả dụng và tải lại dropdown.

---

## NEW-BE-GAP-005 — Danh sách yêu cầu nghỉ thiếu thông tin nhận diện Coach

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008 — màn Manager duyệt nghỉ Coach

### Hiện trạng

API dưới đây chỉ trả `coachId` dạng UUID trong mỗi yêu cầu:

```http
GET /api/v1/manager/coach-leave-requests
```

Manager cần thấy tên và thông tin nhận diện Coach. FE hiện phải gọi thêm `GET /manager/staff-accounts/{coachId}` cho từng UUID, gây N+1 request.

### Contract đề xuất

Bổ sung trực tiếp vào `CoachLeaveResponse`:

```json
{
  "coachId": "uuid",
  "coachFullName": "Nguyễn Văn A",
  "coachPhone": "0900000000"
}
```

### Business rules

1. Thông tin nhận diện phải tương ứng với `coachId` của yêu cầu.
2. Có thể trả dữ liệu hiện tại bằng read-only join hoặc snapshot phù hợp với chính sách audit của hệ thống.
3. Không làm thay đổi quyền xem hoặc quy trình duyệt đơn nghỉ.

### Acceptance criteria

- API danh sách Manager trả `coachFullName` và `coachPhone` cho từng yêu cầu.
- FE tải danh sách bằng một request, không cần gọi API chi tiết cho từng Coach.
- Yêu cầu cũ vẫn trả được thông tin Coach nếu tài khoản còn tồn tại.

### FE follow-up sau khi BE hoàn thành

- Bỏ các request N+1 tới API chi tiết nhân viên.
- Hiển thị `coachFullName` và `coachPhone` trực tiếp từ response đơn nghỉ.

---

## NEW-BE-GAP-006 — Có thể duyệt yêu cầu nghỉ sau khi khoảng nghỉ đã bắt đầu

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008 — lifecycle của yêu cầu nghỉ Coach

### Hiện trạng

Backend chỉ kiểm tra `startTime` phải nằm trong tương lai tại thời điểm Coach tạo yêu cầu. Khi Manager duyệt, backend không kiểm tra lại thời gian hiện tại so với `startTime` và `endTime`.

Do đó một yêu cầu có thể vẫn ở trạng thái `PENDING` và được duyệt sau khi kỳ nghỉ đã bắt đầu, thậm chí sau khi toàn bộ kỳ nghỉ đã kết thúc.

### Contract và trạng thái đề xuất

Bổ sung trạng thái:

```text
EXPIRED
```

Nếu Manager cố duyệt một yêu cầu đã bắt đầu hoặc đã hết hạn:

```http
409 Conflict
Content-Type: application/problem+json

{
  "code": "COACH_LEAVE_ALREADY_STARTED",
  "detail": "A leave request cannot be approved after its start time."
}
```

### Business rules

1. Yêu cầu phải được duyệt trước `startTime`.
2. Khi thời gian hiện tại đã bằng hoặc sau `startTime` mà yêu cầu vẫn `PENDING`, yêu cầu chuyển thành `EXPIRED` hoặc được đánh dấu hết hiệu lực bằng lifecycle tương đương.
3. Yêu cầu `EXPIRED` không thể được duyệt, từ chối hoặc rút.
4. Kiểm tra thời gian phải được thực hiện lại trong transaction duyệt, không chỉ dựa vào trạng thái FE đang hiển thị.
5. Không tạo lịch nghỉ `APPROVED` hồi tố.
6. Lịch sử vẫn hiển thị yêu cầu hết hạn để phục vụ audit.

### Acceptance criteria

- Không thể duyệt yêu cầu khi thời gian hiện tại đã bằng hoặc sau `startTime`.
- Yêu cầu chờ duyệt quá hạn được thể hiện bằng trạng thái `EXPIRED`.
- Hai thao tác duyệt và lifecycle hết hạn chạy đồng thời không tạo trạng thái sai.
- Không phát notification duyệt thành công cho yêu cầu đã hết hạn.
- Yêu cầu hết hạn vẫn xuất hiện trong lịch sử của Coach và Manager.

### FE follow-up sau khi BE hoàn thành

- Hiển thị nhãn `Đã hết hạn` cho trạng thái `EXPIRED`.
- Không hiển thị nút duyệt, từ chối hoặc rút cho yêu cầu đã hết hạn.
- Xử lý lỗi `COACH_LEAVE_ALREADY_STARTED` bằng thông báo rõ ràng và tải lại danh sách.

---

## NEW-BE-GAP-007 — Coach chưa thể hủy lịch nghỉ đã được duyệt

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008 — lifecycle của yêu cầu nghỉ Coach

### Hiện trạng

Backend hiện chỉ cho Coach rút yêu cầu ở trạng thái `PENDING`. Sau khi Manager duyệt và yêu cầu chuyển sang `APPROVED`, Coach không còn cách thông báo rằng mình không cần nghỉ nữa.

Không nên dùng trạng thái `WITHDRAWN` cho trường hợp này vì yêu cầu đã trải qua bước phê duyệt và có thể đã khiến Manager phân công lại, dời hoặc hủy các session liên quan.

### Contract cần bổ sung

Đề xuất endpoint riêng cho việc hủy lịch nghỉ đã duyệt:

```http
PATCH /api/v1/coach/leave-requests/{requestId}/cancel
Authorization: Bearer <coach-access-token>
```

Response thành công:

```http
200 OK
Content-Type: application/json
```

Trả `CoachLeaveResponse` với:

```json
{
  "status": "CANCELLED"
}
```

Bổ sung `CANCELLED` vào `CoachLeaveStatus` và OpenAPI enum.

### Business rules

1. Chỉ chính Coach sở hữu yêu cầu mới được hủy lịch nghỉ.
2. Chỉ cho phép chuyển từ `APPROVED` sang `CANCELLED` khi thời gian hiện tại còn trước `startTime`.
3. Yêu cầu `PENDING` tiếp tục dùng thao tác rút hiện tại và chuyển thành `WITHDRAWN`.
4. Không cho hủy khi kỳ nghỉ đã bắt đầu; trả `409 COACH_LEAVE_ALREADY_STARTED`.
5. Không cho hủy yêu cầu `REJECTED`, `WITHDRAWN`, `EXPIRED` hoặc đã `CANCELLED`.
6. Sau khi chuyển sang `CANCELLED`, Coach được xem là khả dụng cho các phân công mới trong khoảng thời gian đó.
7. Các session đã được phân công lại, dời hoặc hủy để xử lý đơn nghỉ phải giữ nguyên; hệ thống tuyệt đối không tự động khôi phục lịch cũ.
8. Gửi notification cho Manager đã duyệt đơn để họ biết Coach đã trở lại khả dụng.
9. Ghi audit event, đề xuất tên `COACH_LEAVE_CANCELLED`.
10. Kiểm tra thời gian và chuyển trạng thái phải thực hiện trong cùng transaction, có khóa hoặc optimistic concurrency phù hợp.

### Error codes đề xuất

- `COACH_LEAVE_NOT_FOUND`: không tìm thấy hoặc yêu cầu không thuộc Coach hiện tại.
- `COACH_LEAVE_NOT_APPROVED`: trạng thái hiện tại không cho phép hủy lịch nghỉ.
- `COACH_LEAVE_ALREADY_STARTED`: kỳ nghỉ đã bắt đầu nên Coach không thể tự hủy.

### Acceptance criteria

- Coach hủy được yêu cầu `APPROVED` của chính mình trước `startTime`.
- Yêu cầu chuyển thành `CANCELLED` và vẫn tồn tại trong lịch sử.
- Coach trở lại danh sách khả dụng cho phân công mới trong khoảng thời gian đã hủy nghỉ.
- Manager đã duyệt nhận được notification về việc hủy lịch nghỉ.
- Các session từng bị phân công lại, dời hoặc hủy không tự động thay đổi.
- Coach không thể hủy đơn của người khác hoặc đơn chưa/không còn `APPROVED`.
- Coach không thể tự hủy sau khi kỳ nghỉ đã bắt đầu.
- Hai request hủy đồng thời không gây chuyển trạng thái sai hoặc tạo audit trùng.

### FE follow-up sau khi BE hoàn thành

- Hiển thị nút **Hủy lịch nghỉ** cho yêu cầu `APPROVED` chưa tới `startTime`.
- Modal xác nhận phải cảnh báo rằng các buổi tập đã được điều chỉnh sẽ không tự khôi phục.
- Hiển thị nhãn `Đã hủy lịch nghỉ` cho trạng thái `CANCELLED`.
- Sau khi hủy thành công, tải lại danh sách và ẩn thao tác hủy.
- Xử lý các lỗi transition và trường hợp kỳ nghỉ vừa bắt đầu trước khi người dùng xác nhận.

---

## NEW-BE-GAP-008 — Manager chưa nhận notification về thay đổi đơn nghỉ Coach

**Trạng thái:** `OPEN`  
**Liên quan:** MF-008 — notification workflow của yêu cầu nghỉ Coach

### Hiện trạng

Backend hiện gửi notification cho Coach khi Manager duyệt hoặc từ chối đơn nghỉ. Tuy nhiên, Manager không nhận notification khi:

- Coach gửi yêu cầu nghỉ mới.
- Coach rút yêu cầu đang `PENDING`.
- Coach hủy lịch nghỉ đã `APPROVED` theo `NEW-BE-GAP-007`.

Manager vì vậy phải chủ động mở màn hình và tải lại danh sách mới biết có thay đổi.

### Notification events cần bổ sung

```text
COACH_LEAVE_REQUESTED
COACH_LEAVE_WITHDRAWN
COACH_LEAVE_CANCELLED
```

Payload tối thiểu:

```json
{
  "leaveRequestId": "uuid",
  "coachId": "uuid",
  "coachFullName": "Nguyễn Văn A",
  "startTime": "2026-10-25T01:00:00Z",
  "endTime": "2026-10-25T05:00:00Z",
  "status": "PENDING"
}
```

### Business rules

1. Khi Coach tạo đơn, gửi `COACH_LEAVE_REQUESTED` cho các tài khoản Manager đang `ACTIVE`.
2. Khi Coach rút đơn `PENDING`, gửi `COACH_LEAVE_WITHDRAWN` để Manager biết đơn không còn cần xử lý.
3. Khi Coach hủy lịch nghỉ đã duyệt, gửi `COACH_LEAVE_CANCELLED` cho Manager đã duyệt đơn và các Manager đang chịu trách nhiệm vận hành theo cơ chế recipient được hệ thống chốt.
4. Coach tiếp tục nhận notification `COACH_LEAVE_APPROVED` hoặc `COACH_LEAVE_REJECTED` như hiện tại.
5. Notification phải được tạo trong cùng transaction hoặc qua transactional outbox để không phát thông báo cho thao tác thất bại.
6. Dùng idempotency key ổn định theo `requestId`, event và trạng thái để tránh thông báo trùng.
7. Notification phải chứa đủ dữ liệu để FE điều hướng tới màn hình duyệt đơn nghỉ.

### Acceptance criteria

- Manager đang hoạt động nhận notification khi Coach gửi đơn nghỉ mới.
- Manager nhận notification khi đơn chờ duyệt bị Coach rút.
- Manager liên quan nhận notification khi lịch nghỉ đã duyệt bị Coach hủy.
- Coach nhận notification khi đơn được duyệt hoặc từ chối.
- Thao tác thất bại hoặc rollback không tạo notification.
- Gọi lại cùng một transition không tạo notification trùng.
- Notification hiển thị đúng trạng thái chưa đọc và được tính vào unread count.

### FE follow-up sau khi BE hoàn thành

- Bổ sung nội dung tiếng Việt cho ba notification event mới.
- Khi bấm notification của Manager, điều hướng tới `/manager/coach-leave-requests`.
- Tải lại danh sách yêu cầu sau khi mở notification để tránh hiển thị trạng thái cũ.

---

## NEW-BE-GAP-009 — Notification yêu cầu gói tập chỉ gửi cho Member, thiếu người xử lý tiếp theo

**Trạng thái:** `OPEN`  
**Liên quan:** MF-001, MF-006 — membership termination và freeze workflow

### Hiện trạng

Backend hiện đã gửi notification cho Member trong các transition chính:

- Tạo, rút, duyệt, từ chối và thực thi yêu cầu hủy gói.
- Tạo, duyệt chờ thanh toán, từ chối và lên lịch đóng băng.
- Khi Lễ tân tạo yêu cầu hộ, notification vẫn được gửi cho Member sở hữu gói.

Tuy nhiên, recipient hiện luôn là `memberAccountId`. Các actor cần thực hiện bước tiếp theo không được thông báo:

- Manager không nhận notification khi Member hoặc Lễ tân tạo yêu cầu mới cần duyệt.
- Manager không nhận notification khi Member rút yêu cầu đang chờ duyệt.
- Lễ tân không nhận notification khi yêu cầu đóng băng chuyển sang `APPROVED_PENDING_PAYMENT` và cần thu phí tại quầy.
- Sau khi bổ sung khả năng rút yêu cầu đóng băng tại `NEW-BE-GAP-001`, Manager cũng cần được báo khi yêu cầu đó bị rút.

### Nguyên tắc recipient

1. Member luôn nhận notification về mọi thay đổi trạng thái của yêu cầu thuộc gói của mình, kể cả khi yêu cầu được tạo bởi Lễ tân hoặc Manager.
2. Manager đang `ACTIVE` nhận notification cho sự kiện cần duyệt hoặc làm thay đổi hàng đợi duyệt.
3. Lễ tân đang `ACTIVE` nhận notification khi có yêu cầu đóng băng đã duyệt và đang chờ thu phí.
4. Người vừa trực tiếp thực hiện thao tác không cần nhận thêm notification xác nhận cho chính thao tác đó nếu UI đã trả kết quả thành công, trừ khi notification phục vụ lịch sử nghiệp vụ chung.
5. Notification chỉ được tạo sau khi transition thành công, trong cùng transaction hoặc qua transactional outbox.

### Notification routing cần bổ sung

| Event | Member | Manager | Receptionist |
|---|---:|---:|---:|
| `MEMBERSHIP_TERMINATION_REQUESTED` | Có | Có | Không |
| `MEMBERSHIP_TERMINATION_WITHDRAWN` | Có | Có | Không |
| `MEMBERSHIP_TERMINATION_APPROVED` | Có | Không | Không |
| `MEMBERSHIP_TERMINATION_REJECTED` | Có | Không | Không |
| `MEMBERSHIP_TERMINATION_EXECUTED` | Có | Không | Không |
| `MEMBERSHIP_FREEZE_PENDING` | Có | Có | Không |
| `MEMBERSHIP_FREEZE_WITHDRAWN` | Có | Có | Không |
| `MEMBERSHIP_FREEZE_APPROVED_PENDING_PAYMENT` | Có | Không | Có |
| `MEMBERSHIP_FREEZE_REJECTED` | Có | Không | Không |
| `MEMBERSHIP_FREEZE_SCHEDULED` | Có | Không | Không |

Tên event freeze có thể được chuẩn hóa từ `PENDING` thành `REQUESTED`, nhưng phải đồng bộ OpenAPI, notification renderer và dữ liệu hiện có.

### Payload tối thiểu

```json
{
  "requestId": "uuid",
  "memberAccountId": "uuid",
  "memberId": "MB-100001",
  "memberFullName": "Nguyễn Văn A",
  "requestType": "TERMINATION",
  "status": "PENDING"
}
```

Với yêu cầu đóng băng chờ thu phí, payload bổ sung `feeAmount`, `startDate` và `endDate`.

### Acceptance criteria

- Khi Member hoặc Lễ tân tạo yêu cầu hủy/đóng băng, Member và các Manager cần xử lý đều nhận đúng notification.
- Khi Member rút yêu cầu, Manager nhận được notification và không tiếp tục xử lý dữ liệu cũ.
- Khi freeze được duyệt chờ thanh toán, Lễ tân nhận notification chứa số tiền và thông tin Member.
- Member vẫn nhận đầy đủ notification trạng thái như hiện tại.
- Thao tác rollback không phát notification.
- Một transition không tạo notification trùng cho cùng recipient.
- Tài khoản staff `INACTIVE` không nhận notification mới.

### FE follow-up sau khi BE hoàn thành

- Bổ sung nội dung tiếng Việt cho các event trên theo từng vai trò.
- Notification Manager điều hướng tới `/manager/membership-requests`.
- Notification Lễ tân điều hướng tới `/reception/membership-requests` và làm nổi bật yêu cầu chờ thu phí nếu contract hỗ trợ query/deep link.
- Khi mở notification, tải lại dữ liệu thay vì tin vào trạng thái có trong notification cũ.

---

## NEW-BE-GAP-010 — Phòng dùng chung chưa hỗ trợ nhiều session trùng thời gian

**Trạng thái:** `OPEN`  
**Liên quan:** MF-002, US25–US30 — PT 1-1, quản lý phòng và lịch buổi tập

### Hiện trạng

Backend hiện xem một phòng là tài nguyên độc quyền: hai session dùng cùng `roomId` không được chồng thời gian. Rule này phù hợp với phòng Yoga hoặc studio lớp nhóm, nhưng không phù hợp với các địa điểm dùng chung như **Khu PT** hoặc **Khu ngoài trời**, nơi nhiều PT session hoặc lớp nhỏ có thể diễn ra đồng thời.

Việc bỏ hoàn toàn kiểm tra trùng phòng cũng không an toàn vì có thể tạo tổng số người vượt quá sức chứa thực tế của khu vực.

### Thay đổi domain đề xuất

Bổ sung chế độ sử dụng cho Room:

```text
usageMode = EXCLUSIVE | SHARED
```

- `EXCLUSIVE`: giữ nguyên rule hiện tại, không cho session khác chồng thời gian.
- `SHARED`: cho phép nhiều session chồng thời gian nếu tổng sức chứa không vượt `room.capacity`.

Contract tạo/cập nhật Room cần nhận và trả `usageMode`. Dữ liệu Room cũ được backfill thành `EXCLUSIVE` để không thay đổi hành vi hiện tại.

### Business rules

1. Với Room `EXCLUSIVE`, bất kỳ session đang hoạt động nào chồng thời gian đều chặn tạo, dời hoặc đổi phòng.
2. Với Room `SHARED`, backend tính tổng `capacity` của mọi session đang hoạt động chồng với khoảng thời gian cần kiểm tra.
3. Chỉ cho phép mutation khi:

```text
sum(overlapping active session capacity) + requested session capacity
<= room.capacity
```

4. Khi sửa session, loại trừ chính session đó khỏi phép tính tổng.
5. Session `CANCELLED` không chiếm sức chứa khu vực.
6. PT 1-1 vẫn có `session.capacity = 1`.
7. Dù Room là `SHARED`, một Coach vẫn không được phụ trách hai session chồng thời gian.
8. Rule xung đột lịch của Member vẫn giữ nguyên, không phụ thuộc `usageMode` của Room.
9. Kiểm tra sức chứa và ghi session phải nằm trong cùng transaction với locking/concurrency control phù hợp; hai request đồng thời không được cùng vượt qua kiểm tra rồi làm quá tải khu vực.
10. `room.capacity` phải lớn hơn hoặc bằng capacity của từng session được đặt tại Room.
11. Room đang có session tương lai chỉ được giảm capacity khi toàn bộ các khoảng thời gian liên quan vẫn thỏa rule tổng sức chứa.

### Error codes đề xuất

- `ROOM_TIME_CONFLICT`: Room `EXCLUSIVE` đã có session chồng giờ.
- `SHARED_ROOM_CAPACITY_EXCEEDED`: tổng sức chứa của Room `SHARED` sẽ bị vượt.
- `ROOM_CAPACITY_BELOW_SESSION_CAPACITY`: capacity Room không đủ cho riêng session.

Response lỗi `SHARED_ROOM_CAPACITY_EXCEEDED` nên trả thêm dữ liệu để FE giải thích:

```json
{
  "code": "SHARED_ROOM_CAPACITY_EXCEEDED",
  "roomCapacity": 10,
  "occupiedCapacity": 8,
  "requestedCapacity": 3
}
```

### Acceptance criteria

- Hai session trùng giờ không thể cùng dùng Room `EXCLUSIVE`.
- Nhiều session được dùng Room `SHARED` khi tổng capacity không vượt giới hạn.
- Mutation bị từ chối khi tổng capacity vượt giới hạn và không tạo dữ liệu một phần.
- Session bị hủy được loại khỏi phép tính sức chứa.
- Sửa một session không tự tính trùng với chính nó.
- Hai Manager tạo session đồng thời không thể làm tổng capacity vượt Room.
- Coach vẫn bị chặn nếu được phân công hai session trùng giờ, kể cả hai session dùng Room `SHARED` khác nhau.
- Room cũ sau migration tiếp tục hoạt động theo chế độ `EXCLUSIVE`.

### FE follow-up sau khi BE hoàn thành

- Thêm lựa chọn **Phòng riêng** / **Khu vực dùng chung** trong form tạo và sửa Room.
- Hiển thị `usageMode` trong danh sách và chi tiết Room bằng nhãn dễ hiểu, không lộ enum kỹ thuật.
- Tại form tạo/sửa session, hiển thị sức chứa còn khả dụng của khu vực trong khoảng giờ đã chọn nếu backend cung cấp dữ liệu availability.
- Xử lý ba error code trên bằng thông báo tiếng Việt và giữ nguyên dữ liệu form để Manager điều chỉnh.
