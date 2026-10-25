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

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-006

**Trạng thái:** `DONE`
**Hoàn thành:** BE `00e27b1`; FE `875f005`; luồng rút yêu cầu `PENDING` đã được tích hợp và kiểm thử.
**Liên quan:** MF-006 — Membership freeze request workflow

### Hiện trạng khi phát hiện

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

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-001, MF-006

**Trạng thái:** `DONE`
**Hoàn thành:** BE `34a379a`; FE `875f005`; danh sách Manager đã dùng tên và mã hội viên từ response.
**Liên quan:** MF-001, MF-006 — màn duyệt yêu cầu của Manager

### Hiện trạng khi phát hiện

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

**Trạng thái:** `DONE`
**Hoàn thành:** BE `b5cb91c`; FE `875f005`; Manager được chặn duyệt và thấy các session cần xử lý trước.
**Liên quan:** MF-008 — Coach leave approval flow

### Hiện trạng khi phát hiện

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

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

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-001, MF-006

**Trạng thái:** `DONE`
**Hoàn thành:** BE `dd4f90d`; FE `875f005`; notification đã được định tuyến và hiển thị cho nhân viên xử lý tiếp theo.
**Liên quan:** MF-001, MF-006 — membership termination và freeze workflow

### Hiện trạng khi phát hiện

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

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002

**Trạng thái:** `DONE`
**Hoàn thành:** BE `4e26d56`; FE `875f005`; UI và validation đã đồng bộ mô hình phòng `EXCLUSIVE`/`SHARED`.
**Liên quan:** MF-002, US25–US30 — PT 1-1, quản lý phòng và lịch buổi tập

### Hiện trạng khi phát hiện

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

---

## NEW-BE-GAP-011 — Danh sách hoàn tiền thiếu mã nghiệp vụ và thông tin nhận diện hội viên

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-007

**Trạng thái:** `OPEN`
**Liên quan:** Luồng hoàn tiền tiền mặt cho gói đã chấm dứt hoặc gói đặt trước bị hủy

### Hiện trạng

`RefundRequestResponse` hiện chỉ trả các khóa nội bộ dạng UUID:

```text
paymentId
orderId
membershipId
receiptId
memberAccountId
```

Hai API danh sách dưới đây vì vậy không cung cấp đủ dữ liệu để nhân viên nhận diện yêu cầu theo ngôn ngữ nghiệp vụ:

```text
GET /reception/refund-requests
GET /manager/refund-requests
```

FE tạm thời hiển thị UUID theo quyết định của nhóm để không chặn việc kiểm thử workflow. Đây không phải trạng thái UX cuối cùng.

### Contract đề xuất

Bổ sung tối thiểu vào `RefundRequestResponse`:

```json
{
  "memberCode": "MB-100001",
  "memberFullName": "Nguyễn Văn A",
  "orderNumber": "ORD-20261023-0001",
  "paymentReference": "PAY-20261023-0001",
  "receiptNumber": "RCP-20261023-0001"
}
```

Các UUID vẫn được giữ để FE gửi mutation và làm React key, nhưng không dùng làm nhãn chính sau khi có các display field trên.

### Acceptance criteria

- Danh sách hoàn tiền của Lễ tân và Quản lý hiển thị tên cùng mã hội viên.
- Nhân viên phân biệt được đơn hàng, giao dịch và biên lai bằng mã nghiệp vụ, không cần đọc UUID.
- Tất cả response create/approve/disburse/finalize/reject trả cùng bộ display field với response danh sách.
- Các display field là snapshot hoặc được resolve nhất quán; dữ liệu lịch sử không biến mất khi tài khoản hay bản ghi nguồn thay đổi trạng thái.
- UUID chỉ còn được sử dụng nội bộ cho API path, optimistic locking và liên kết dữ liệu.

### FE follow-up sau khi BE hoàn thành

- Ưu tiên `memberFullName`, `memberCode`, `orderNumber`, `paymentReference`, `receiptNumber` trên các bảng và modal hoàn tiền.
- Loại bỏ toàn bộ UUID đang được hiển thị tạm thời.
- Không cần thay đổi endpoint mutation hoặc cơ chế `expectedVersion`.

---

## NEW-BE-GAP-012 — Workflow hoàn tiền chưa thông báo cho nhân viên phụ trách bước kế tiếp

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-007

**Trạng thái:** `OPEN`
**Liên quan:** Workflow hoàn tiền nhiều bước giữa Lễ tân và Quản lý

### Hiện trạng

`MembershipRefundService.write(...)` hiện ghi mọi notification `MEMBERSHIP_REFUND_*` cho `memberAccountId`. Vì vậy Member nhận được lịch sử thay đổi, nhưng nhân viên cần thực hiện bước kế tiếp không được thông báo:

- Khi Lễ tân tạo yêu cầu `REQUESTED`, Manager không nhận thông báo cần duyệt bước đầu.
- Khi Manager chuyển yêu cầu sang `FIRST_APPROVED`, Lễ tân không nhận thông báo cần giao tiền mặt.
- Khi Lễ tân chuyển yêu cầu sang `CASH_DISBURSED`, Manager không nhận thông báo cần xác nhận cuối.
- Khi Manager từ chối hoặc hoàn tất, Member vẫn cần nhận thông báo như hiện tại.

FE đã có route nhận notification cho `/reception/refunds` và `/manager/refunds`, nhưng các route này chỉ phát huy tác dụng khi backend gửi notification đúng recipient.

### Notification routing đề xuất

| Event | Member | Manager | Receptionist |
|---|---:|---:|---:|
| `MEMBERSHIP_REFUND_REQUESTED` | Có | Có | Không |
| `MEMBERSHIP_REFUND_FIRST_APPROVED` | Có | Không | Có |
| `MEMBERSHIP_REFUND_CASH_DISBURSED` | Có | Có | Không |
| `MEMBERSHIP_REFUND_COMPLETED` | Có | Không | Có nếu cần đối soát |
| `MEMBERSHIP_REFUND_REJECTED` | Có | Không | Có nếu Lễ tân là người tạo |

Payload cho staff nên chứa tối thiểu `refundRequestId`, `memberCode`, `memberFullName`, `status` và `approvedAmount` khi đã có.

### Acceptance criteria

- Manager đang hoạt động nhận thông báo khi có yêu cầu mới và khi tiền mặt đã được giao.
- Lễ tân đang hoạt động nhận thông báo khi yêu cầu được duyệt bước đầu và cần giao tiền.
- Member tiếp tục nhận mọi thay đổi trạng thái của yêu cầu thuộc gói mình.
- Notification chỉ được phát sau transition thành công và không bị trùng khi retry/idempotent replay.
- Bấm notification của staff điều hướng đúng màn hình hoàn tiền theo vai trò.

---

## NEW-BE-GAP-013 — Đổi Coach của PT session chưa bảo toàn Booking và Waitlist hiện hữu

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002, MF-009, MF-010

**Trạng thái:** `OPEN`
**Liên quan:** MF-002, MF-009, MF-010 — PT 1-1, đổi phân công Session và Waitlist

### Hiện trạng

`PATCH /api/v1/manager/class-sessions/{sessionId}/assignment` hiện cho phép Manager đổi
Coach của một PT session sau khi kiểm tra lịch của Coach mới, nhưng không kiểm tra các
Booking `BOOKED` và Waitlist `WAITING` đã tồn tại trên session.

Các Member đó có thể chỉ có Coach Assignment với Coach cũ. Sau khi đổi Coach, dữ liệu
đang tồn tại không còn thỏa rule đặt PT, trong khi rule này chỉ được kiểm tra lúc tạo
Booking/Waitlist hoặc lúc promote Waitlist.

### Business rules cần chốt vào contract

1. Trước khi đổi Coach của session `PT_1_1`, backend phải khóa và kiểm tra toàn bộ
   Booking `BOOKED` cùng Waitlist `WAITING` của session.
2. Chỉ cho đổi khi mọi Member liên quan có Coach Assignment `ACTIVE` với Coach mới.
3. Nếu chưa thỏa, từ chối mutation và trả danh sách Member/Booking/Waitlist bị ảnh
   hưởng để Manager xử lý; không tự để dữ liệu rơi vào trạng thái sai.
4. Không cho phép giải pháp âm thầm giữ Booking nhưng đợi tới lần đọc hoặc promote mới
   phát hiện sai Coach Assignment.
5. Việc kiểm tra và đổi Coach phải nằm trong cùng transaction, có locking chống race
   với thao tác Booking/Waitlist đồng thời.

### Error code đề xuất

`PT_SESSION_ASSIGNMENT_HAS_INCOMPATIBLE_MEMBERS`

Response nên chứa `affectedBookings` và `affectedWaitlists`, mỗi phần tử có tối thiểu
`memberAccountId`, `memberCode`, `memberFullName` và ID bản ghi liên quan.

### Acceptance criteria

- PT session chưa có Booking/Waitlist được đổi Coach bình thường.
- Nếu có bất kỳ Member nào không được phân công cho Coach mới, mutation bị từ chối và
  session vẫn giữ Coach cũ.
- Sau khi Manager xử lý hết dữ liệu bị ảnh hưởng, thao tác đổi Coach thành công.
- Request đồng thời không thể tạo Booking/Waitlist theo Coach cũ sau khi kiểm tra nhưng
  trước khi session được đổi sang Coach mới.

### FE follow-up sau khi BE hoàn thành

- Hiển thị danh sách Member bị ảnh hưởng thay vì chỉ báo lỗi chung.
- Giữ form đổi Coach mở để Manager xử lý rồi tải lại.
- Không tự suy luận tính tương thích chỉ từ dữ liệu FE; mutation BE vẫn là nguồn quyết định.

---

## NEW-BE-GAP-014 — Kết thúc hoặc đổi Coach Assignment chưa xử lý PT Booking và Waitlist tương lai

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002, MF-010

**Trạng thái:** `OPEN`
**Liên quan:** MF-002, MF-010 — Coach Assignment và PT 1-1

### Hiện trạng

Khi Manager kết thúc Coach Assignment hoặc đổi Member sang Coach khác,
`CoachAssignmentService` hiện kết thúc assignment cũ và tạo assignment mới mà không
xử lý các PT Booking/Waitlist tương lai gắn với Coach cũ.

Member vì vậy vẫn có thể còn lịch PT đã đặt với người không còn là Coach được phân công,
hoặc nằm trong hàng chờ mà chắc chắn sẽ bị `SKIPPED` khi promote.

### Business rules

1. Backend phải preview toàn bộ PT Booking `BOOKED` và Waitlist `WAITING` tương lai bị
   ảnh hưởng trước khi kết thúc hoặc đổi Coach Assignment.
2. Không được kết thúc assignment mà âm thầm giữ các lịch PT không còn hợp lệ.
3. Khi Manager xác nhận kết thúc/đổi assignment, backend hủy các Booking bị ảnh hưởng
   và đóng các Waitlist tương ứng trong cùng transaction.
4. Member nhận notification cho từng lịch/hàng chờ bị hủy, kèm lý do Coach Assignment
   đã thay đổi.
5. Mỗi Booking bị hủy phải giải phóng chỗ và kích hoạt quy trình promote Waitlist của
   session đó nếu còn người đủ điều kiện.
6. Response trả số lượng và danh sách Booking/Waitlist đã xử lý để FE báo kết quả thật.

### Acceptance criteria

- Không còn Booking PT tương lai với Coach cũ sau khi assignment kết thúc hoặc bị thay thế.
- Không còn Waitlist `WAITING` không tương thích với assignment mới.
- Member được thông báo rõ về các lịch bị hủy.
- Các chỗ trống phát sinh được đưa qua cơ chế promote Waitlist bình thường.
- Toàn bộ thay đổi assignment, booking, waitlist, audit và notification nhất quán trong
  cùng transaction.

### FE follow-up sau khi BE hoàn thành

- Hiển thị preview ảnh hưởng trong modal kết thúc/đổi Coach Assignment.
- Yêu cầu Manager xác nhận sau khi đã thấy danh sách lịch bị hủy.
- Hiển thị kết quả từ response, không tự giả định số lượng đã xử lý.

---

## NEW-BE-GAP-015 — Waitlist không được promote khi Booking bị hủy bởi lifecycle khác

**Phụ trách chính:** @Nhật Khánh
**Phối hợp:** @Nguyễn Thiện
**Nguồn MF:** MF-010; liên quan MF-001, MF-006

**Trạng thái:** `OPEN`
**Liên quan:** MF-001, MF-006, MF-010 — Termination, Freeze và Waitlist

### Hiện trạng

Luồng hủy Booking trực tiếp của Member/Lễ tân gọi `promoteAvailable(session)`. Tuy nhiên,
Booking tương lai bị hủy hàng loạt bởi các lifecycle khác chưa đi qua cơ chế này, gồm:

- Manager suspend Member;
- Membership termination có hiệu lực;
- Membership freeze bắt đầu;
- kết thúc/đổi Coach Assignment sau khi `NEW-BE-GAP-014` được triển khai.

Session có thể đã trống chỗ nhưng người đầu Waitlist vẫn nằm ở `WAITING`.

### Contract và business rules

1. Mọi thao tác chuyển Booking `BOOKED -> CANCELLED` phải trả hoặc thu thập tập
   `sessionId` bị ảnh hưởng.
2. Sau khi hủy, mỗi session còn `SCHEDULED` phải chạy promotion đúng một cách an toàn.
3. Promotion vẫn kiểm tra lại eligibility và FIFO như luồng hủy trực tiếp.
4. Bulk cancellation và promotion phải có locking/idempotency để không vượt capacity.
5. Không promote nếu chính session đã bị `CANCELLED`.

### Acceptance criteria

- Freeze, termination hoặc suspend Member làm trống chỗ đều tự promote người đầu đủ
  điều kiện.
- Nhiều Booking của cùng session bị hủy trong một batch không tạo Booking vượt capacity.
- Không có session còn chỗ trong khi vẫn còn Waitlist `WAITING` đủ điều kiện chỉ vì nguồn
  hủy Booking khác nhau.

### FE follow-up sau khi BE hoàn thành

- Không cần tự gọi API promote từ FE.
- FE chỉ tải lại lịch/Waitlist sau mutation và hiển thị trạng thái authoritative từ BE.

---

## NEW-BE-GAP-016 — Waitlist hết hạn xử lý lazy và Member bị skip không được thông báo

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-010

**Trạng thái:** `OPEN`
**Liên quan:** MF-010 — Waitlist lifecycle

### Hiện trạng

Waitlist quá giờ bắt đầu chỉ được chuyển sang `EXPIRED` khi một API Waitlist được gọi
hoặc khi promotion chạy. Scheduler vòng đời Session hiện không chủ động reconcile các
entry này. Ngoài ra, khi promotion kiểm tra lại eligibility và đánh entry `SKIPPED`, hệ
thống chỉ ghi audit mà không gửi notification cho Member.

### Business rules

1. Scheduler khi chuyển Session sang `IN_PROGRESS` phải đóng toàn bộ Waitlist `WAITING`
   của session thành `EXPIRED` trong cùng chu kỳ reconcile.
2. Expiration phải idempotent và không phụ thuộc có người mở màn hình Waitlist hay không.
3. Khi entry bị `SKIPPED`, Member phải nhận notification với lý do thân thiện, ví dụ gói
   hết hạn, trùng lịch, Membership đang freeze hoặc Coach Assignment PT không còn hợp lệ.
4. Notification không lộ raw error/enum; payload giữ `reasonCode` ổn định để FE dịch.

### Acceptance criteria

- Sau giờ bắt đầu, không còn Waitlist `WAITING` dù không ai gọi API đọc.
- Entry không đủ điều kiện khi promote chuyển `SKIPPED` và Member nhận đúng một notification.
- Retry scheduler/promotion không phát notification trùng.

### FE follow-up sau khi BE hoàn thành

- Thêm nhãn và nội dung cho notification `WAITLIST_SKIPPED`/`WAITLIST_EXPIRED`.
- Hiển thị lý do kết thúc hàng chờ dựa trên `terminalReasonCode`.

---

## NEW-BE-GAP-017 — Chưa có API tra cứu Room khả dụng theo khoảng thời gian

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002, MF-009

**Trạng thái:** `OPEN`
**Liên quan:** MF-002, MF-009, NEW-BE-GAP-010 — PT, dời lịch và Room dùng chung

### Hiện trạng

Các form tạo, dời hoặc đổi Room chỉ tải được toàn bộ Room `ACTIVE`. FE không biết Room
nào thực sự còn khả dụng trong khoảng thời gian đã chọn, đặc biệt với `SHARED` cần tính
tổng capacity đang sử dụng. Manager phải chọn thử rồi chờ mutation BE từ chối.

### Contract đề xuất

```http
GET /api/v1/manager/rooms/availability
    ?startTime=<ISO-8601-instant>
    &endTime=<ISO-8601-instant>
    &requestedCapacity=<positive-int>
    &excludeSessionId=<optional-uuid>
```

Mỗi item nên trả `roomId`, `name`, `usageMode`, `capacity`, `occupiedCapacity`,
`availableCapacity` và `available`.

### Business rules

1. Chỉ trả hoặc đánh dấu Room `ACTIVE`.
2. Room `EXCLUSIVE` khả dụng khi không có session/suspension chồng giờ.
3. Room `SHARED` khả dụng khi tổng capacity sau khi thêm request không vượt capacity.
4. Khi sửa session, loại trừ chính session đó khỏi phép tính.
5. API chỉ hỗ trợ UX; mutation vẫn kiểm tra lại trong transaction để chống race.

### Acceptance criteria

- Dropdown có thể phân biệt Room khả dụng và không khả dụng trước khi submit.
- Kết quả đúng cho cả `EXCLUSIVE`, `SHARED`, suspension và `excludeSessionId`.
- Mutation vẫn từ chối an toàn nếu availability thay đổi sau lúc discovery.

### FE follow-up sau khi BE hoàn thành

- Tải lại danh sách Room mỗi khi khoảng giờ hoặc capacity thay đổi.
- Ưu tiên hiển thị Room khả dụng; giải thích sức chứa còn lại cho Room `SHARED`.

---

## NEW-BE-GAP-018 — Số lượng Session của recurring schedule đang cố định 30

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002, MF-009

**Trạng thái:** `OPEN`
**Mức ưu tiên:** `REQUIRED`
**Liên quan:** MF-002 và quản lý lịch định kỳ

### Hiện trạng

Backend hardcode `OCCURRENCE_COUNT = 30`; Manager không thể chọn số buổi cần tạo. Điều
này làm recurring schedule kém phù hợp cho khóa PT hoặc lớp nhóm có số buổi cụ thể.

### Contract cần bổ sung

Bổ sung `sessionCount` vào request tạo recurring schedule, với giới hạn đề xuất
`1..100`. Response tiếp tục trả số session thực tế đã tạo.

### Business rules

1. Không gửi `sessionCount` có thể mặc định `30` để tương thích client cũ.
2. Validate toàn bộ occurrence trước khi ghi; không tạo một phần khi occurrence bất kỳ
   xung đột.
3. Giới hạn tối đa để tránh request quá lớn và lock quá lâu.

### Acceptance criteria

- Manager chọn được số buổi khi tạo recurring schedule.
- Giá trị ngoài giới hạn trả `VALIDATION_ERROR` theo field `sessionCount`.
- Client cũ không gửi field vẫn tạo 30 buổi như trước.

### FE follow-up sau khi BE hoàn thành

- Thêm trường **Số buổi** vào form recurring, mặc định 30.
- Hiển thị số occurrence trong bước xác nhận trước khi tạo.

---

## NEW-BE-GAP-019 — Chưa có API tra cứu nguồn hoàn tiền đủ điều kiện cho Lễ tân

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-007

**Trạng thái:** `OPEN`
**Liên quan:** MF-007 — Refund workflow

### Hiện trạng

FE hiện ghép lịch sử Membership với danh sách biên lai để tìm payment tiền mặt đủ điều
kiện. Tuy nhiên API biên lai của Lễ tân chỉ cho xem biên lai do chính tài khoản đó xử lý.
Một Lễ tân khác vẫn có thể được giao xử lý hoàn tiền nhưng không tra được nguồn, phải
nhập `paymentId` và `membershipId` UUID thủ công.

### Contract đề xuất

```http
GET /api/v1/reception/members/{memberCode}/refund-eligible-sources
```

Response chỉ trả các nguồn mà backend xác định có khả năng tạo refund, kèm tối thiểu:
`paymentId`, `membershipId`, `receiptId`, `receiptNumber`, `offerName`, `type`,
`paidAmount`, `suggestedAmount` và lý do không đủ điều kiện nếu lựa chọn trả cả item bị
loại.

### Business rules

1. Chỉ Receptionist `ACTIVE` được gọi.
2. Chỉ trả payment `CASH/PAID` thuộc đúng Member.
3. Áp dụng cùng eligibility và công thức tại thời điểm đọc như mutation tạo refund;
   mutation vẫn kiểm tra lại trong transaction.
4. Không mở rộng quyền đọc biên lai chung ngoài mục đích refund.

### Acceptance criteria

- Bất kỳ Lễ tân hợp lệ nào cũng tìm được nguồn hoàn của Member mà không cần UUID thủ công.
- Item hiển thị bằng mã nghiệp vụ và tên gói, không lộ UUID làm nhãn chính.
- Nguồn vừa mất eligibility bị mutation từ chối an toàn dù từng xuất hiện trong discovery.

### FE follow-up sau khi BE hoàn thành

- Thay phép ghép receipt/membership phía FE bằng endpoint discovery.
- Xóa ô nhập UUID thủ công khỏi luồng nghiệp vụ bình thường.

---

## NEW-BE-GAP-020 — Danh sách lịch Coach thiếu dữ liệu hiển thị, buộc FE gọi N+1

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-008

**Trạng thái:** `OPEN`
**Liên quan:** Coach Dashboard và Coach Schedule

### Hiện trạng

`GET /api/v1/coach/class-sessions` hiện chỉ trả ID và dữ liệu lịch cơ bản. Để hiển thị
tên lớp, loại lớp, phòng và số người đã đặt, FE đang phải gọi tiếp
`GET /api/v1/coach/class-sessions/{sessionId}` cho từng phần tử trong danh sách.

Coach Dashboard còn tải chi tiết tới 100 session để tổng hợp lớp và hội viên. Coach
Schedule cũng dùng `Promise.all` trên toàn bộ session của tuần. Đây là N+1 request,
làm trang chậm và tạo tải không cần thiết lên backend.

### Contract cần bổ sung

Mỗi phần tử của response danh sách Coach cần trả đủ read model tối thiểu:

```json
{
  "id": "uuid",
  "classId": "uuid",
  "className": "Yoga cơ bản",
  "classType": "GROUP",
  "disciplineName": "Yoga",
  "roomId": "uuid",
  "roomName": "Phòng Yoga 1",
  "startTime": "2026-10-24T01:00:00Z",
  "endTime": "2026-10-24T02:00:00Z",
  "capacity": 20,
  "bookedCount": 12,
  "status": "SCHEDULED"
}
```

Nếu Dashboard vẫn cần số hội viên duy nhất trên nhiều session, backend phải cung cấp
aggregate hoặc endpoint summary riêng; FE không được tải chi tiết từng session để tự
đếm.

### Business rules

1. Chỉ trả các session thuộc Coach đang đăng nhập như contract hiện tại.
2. `bookedCount` chỉ tính Booking đang chiếm chỗ theo cùng rule capacity của backend.
3. Các tên hiển thị là read-only projection; không thay thế ID trong mutation.
4. Dữ liệu danh sách phải hỗ trợ phân trang và filter hiện có mà không phát sinh truy
   vấn riêng cho từng row ở tầng persistence.

### Acceptance criteria

- Coach Schedule hiển thị tên lớp, loại lớp, phòng và sĩ số bằng một request danh sách.
- Coach Dashboard không gọi API chi tiết cho toàn bộ session khi tải trang.
- Mở chi tiết một session vẫn được phép gọi endpoint chi tiết đúng một lần theo thao tác
  của người dùng.
- Số đã đặt và sức chứa hiển thị thống nhất với rule booking/capacity của backend.

### FE follow-up sau khi BE hoàn thành

- Xóa `fetchDetails()` và `Promise.all(getCoachSession)` khỏi Dashboard/Schedule.
- Render trực tiếp read model từ API list.
- Chỉ gọi API chi tiết khi Coach chủ động mở một session.

---

## NEW-BE-GAP-021 — Tra cứu hội viên tại quầy thiếu tóm tắt gói đang sử dụng

**Phụ trách:** @Nguyễn Thiện
**Nguồn MF:** MF-014

**Trạng thái:** `OPEN`
**Liên quan:** Receptionist Center Check-in

### Hiện trạng

`GET /api/v1/reception/members/search` chỉ trả hồ sơ tài khoản. Màn check-in không thể
cho Lễ tân biết hội viên đang dùng gói nào và còn hiệu lực đến ngày nào nếu không gọi
thêm API lịch sử Membership sau mỗi lần tìm kiếm.

FE không thực hiện cách ghép N+1 này. Backend cần trả read model đủ cho nghiệp vụ tại
quầy trong cùng response tra cứu.

### Contract cần bổ sung

Bổ sung tóm tắt Membership hiện tại vào `ReceptionMemberSearchResponse`:

```json
{
  "memberId": "MB-100001",
  "fullName": "Nguyễn Văn A",
  "status": "ACTIVE",
  "activeMembership": {
    "membershipId": "uuid",
    "offerName": "Plus 3 tháng",
    "planName": "Plus",
    "effectiveStartDate": "2026-10-01",
    "effectiveEndDate": "2026-12-30",
    "status": "ACTIVE",
    "benefitCodes": ["CENTER_ACCESS"]
  }
}
```

`activeMembership` có thể là `null` khi không có gói hiệu lực.

### Acceptance criteria

- Một request tra cứu đủ để Lễ tân thấy gói hiện tại và ngày hết hạn.
- Tóm tắt phản ánh đúng trạng thái freeze/termination tại thời điểm đọc.
- Không phát sinh request Membership riêng cho từng lần tra cứu hội viên.
- Mutation check-in vẫn kiểm tra lại eligibility trong transaction.

### FE follow-up sau khi BE hoàn thành

- Hiển thị tên gói, thời hạn và trạng thái ngay trên thẻ hội viên tại quầy.
- Thêm lối tắt sang bán gói khi không có Membership phù hợp.

---

## NEW-BE-GAP-022 — Danh sách hội viên của Coach chưa hỗ trợ tìm kiếm server-side

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002

**Trạng thái:** `OPEN`
**Liên quan:** Coach Assigned Member List

### Hiện trạng

`GET /api/v1/coach/members` chỉ nhận `page` và `size`. FE không thể cung cấp tìm kiếm
đúng trên toàn bộ danh sách phân trang. Lọc riêng 20 phần tử của trang hiện tại sẽ tạo
trải nghiệm sai vì hội viên có thể nằm ở trang khác.

### Contract cần bổ sung

Thêm query `q` tùy chọn vào endpoint hiện tại:

```http
GET /api/v1/coach/members?q=MB-100001&page=0&size=20
```

Tìm kiếm theo mã hội viên, họ tên hoặc số điện thoại trong phạm vi các Member đang được
phân công cho Coach đăng nhập.

### Acceptance criteria

- Kết quả tìm kiếm đúng trên toàn bộ tập dữ liệu, không chỉ trang đang mở.
- Query được trim, giới hạn độ dài và phân trang như danh sách thường.
- Coach không thể tìm thấy Member ngoài phạm vi Coach Assignment của mình.
- Query rỗng giữ nguyên hành vi danh sách hiện tại.

### FE follow-up sau khi BE hoàn thành

- Thêm ô tìm kiếm đồng bộ với URL.
- Gửi `q` cùng request danh sách và đưa page về 0 khi query thay đổi.

---

## NEW-BE-GAP-023 — Yêu cầu kích hoạt thủ công thiếu thông tin người gửi để hiển thị

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-012

**Trạng thái:** `OPEN`
**Liên quan:** Manager Manual Email Activation Review

### Hiện trạng

Response danh sách yêu cầu kích hoạt thủ công chỉ trả `requestedByAccountId` dạng UUID.
Manager không thể biết Lễ tân nào đã xác minh và gửi yêu cầu nếu FE không gọi thêm API
chi tiết tài khoản cho từng dòng. FE không thực hiện cách ghép N+1 này và hiện ẩn UUID
khỏi bảng nghiệp vụ.

### Contract cần bổ sung

Bổ sung read-only projection vào response danh sách và chi tiết:

```json
{
  "requestedByAccountId": "uuid",
  "requestedByName": "Trần Lễ Tân",
  "requestedByRole": "RECEPTIONIST"
}
```

### Acceptance criteria

- Manager nhìn thấy tên người gửi trên danh sách mà không cần request phụ.
- Dữ liệu lịch sử vẫn hiển thị được tên snapshot nếu tài khoản người gửi đã ngưng hoạt động.
- UUID tiếp tục dùng nội bộ cho liên kết nhưng không xuất hiện như nhãn chính trên UI.

### FE follow-up sau khi BE hoàn thành

- Khôi phục cột “Người gửi” bằng `requestedByName`.
- Việt hóa vai trò nếu cần hiển thị trong chi tiết.

---

## NEW-BE-GAP-024 — Lịch sử kết quả và nhận xét thiếu ngữ cảnh hiển thị

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-002

**Trạng thái:** `OPEN`
**Liên quan:** Member Training Results / Training Feedback

### Hiện trạng

`MemberTrainingResultResponse` và `MemberTrainingFeedbackResponse` chỉ chứa các UUID
liên kết như `createdByAccountId` và `classSessionId`. Vì vậy Member không biết nội dung
do HLV nào ghi nhận và thuộc buổi tập nào. FE không gọi thêm API tài khoản và session
cho từng dòng lịch sử vì sẽ tạo N+1 request.

### Contract cần bổ sung

Bổ sung read-only display projection phù hợp với từng bản ghi:

```json
{
  "coachName": "Nguyễn Văn HLV",
  "sessionName": "PT 1-1 cùng Nguyễn Văn HLV",
  "sessionStartTime": "2026-10-24T01:00:00Z",
  "className": null
}
```

Các trường session có thể `null` với nội dung PT tổng quát không gắn một buổi cụ thể.

### Acceptance criteria

- Member nhận biết được ai tạo nội dung và nội dung thuộc buổi nào khi có liên kết.
- Danh sách vẫn được tải bằng một request có phân trang, không phát sinh request theo dòng.
- Dữ liệu lịch sử vẫn có nhãn hiển thị nếu HLV hoặc session sau đó ngưng hoạt động.

### FE follow-up sau khi BE hoàn thành

- Hiển thị tên HLV và buổi tập trên thẻ kết quả/nhận xét.
- Chỉ hiển thị thông tin thực sự có trong read model; không lộ UUID liên kết.

---

## NEW-BE-GAP-025 — Room Impact chưa có bulk resolution ở cấp contract

**Phụ trách:** @Nhật Khánh
**Nguồn MF:** MF-009

**Trạng thái:** `OPTIONAL — CẦN CHỐT VỚI TEAM`
**Liên quan:** Manager Room Impact

### Hiện trạng

API hiện nhận một `resolution` riêng cho từng session bị ảnh hưởng. FE có thể hỗ trợ
“Áp dụng cho tất cả” bằng cách sao chép cùng action/phòng đích/lý do vào toàn bộ mảng
`resolutions`, nhưng vẫn phải materialize từng session ID từ kết quả preview.

Cách này dùng được cho UI hiện tại, tuy nhiên contract chưa biểu diễn trực tiếp ý định
bulk và backend phải nhận payload dài khi một phòng ảnh hưởng nhiều session.

### Contract đề xuất nếu team chốt làm

Cho phép request apply/extend nhận thêm bulk template tùy chọn:

```json
{
  "bulkResolution": {
    "action": "MOVE",
    "targetRoomId": "uuid",
    "reason": null
  },
  "resolutionOverrides": []
}
```

Backend phải áp dụng template cho tập session của preview mới nhất, sau đó áp dụng
override theo `sessionId`, kiểm tra availability/capacity và commit toàn bộ trong cùng
transaction. `CANCEL` cũng có thể dùng lý do chung. `RESCHEDULE` không nên dùng bulk
template nếu mỗi session cần thời gian mới khác nhau.

### Acceptance criteria

- Một bulk action không bỏ sót session mới phát sinh trong khoảng ảnh hưởng.
- Toàn bộ thao tác vẫn atomic; một session không hợp lệ thì không áp dụng dở dang.
- Backend trả lỗi chỉ rõ session nào làm bulk action thất bại.
- FE vẫn có thể override từng session sau khi chọn cách xử lý chung.

### FE hiện tại

- FE đã có thao tác “Áp dụng cho tất cả” cho `MOVE` và `CANCEL` bằng contract
  `resolutions[]` hiện hữu.
- Nếu backend bổ sung bulk contract, FE chuyển sang gửi intent bulk và chỉ gửi các dòng
  được Manager chỉnh riêng làm override.
