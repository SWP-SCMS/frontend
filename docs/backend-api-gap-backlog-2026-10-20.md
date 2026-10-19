# Backend API & Contract Gap Backlog

**Ngày kiểm tra:** 20/10/2026  
**Backend được đối chiếu:** `main` tại `056d00e`  
**Frontend được đối chiếu:** `feat/phase-4-coach-assignments` tại `bb0e8a1` và working tree hiện tại  
**Trạng thái tài liệu:** Living backlog — cập nhật khi phát hiện hoặc khi Backend đóng một gap

## Mục đích và quy ước

Tài liệu này gom các API/contract Backend đang thiếu, chưa đủ dữ liệu hoặc còn quyết định nghiệp vụ chưa chốt khiến Frontend phải chờ, dùng fallback hoặc không thể hoàn thiện UX.

- Chỉ ghi finding đã kiểm tra trực tiếp trên Backend source hiện tại.
- Không ghi lỗi thuần Frontend.
- Không coi đề xuất endpoint trong tài liệu là đã tồn tại cho đến khi Backend merge code và OpenAPI.
- Backend vẫn là nguồn xác thực cuối cùng cho mọi mutation và eligibility.
- Khi Backend hoàn thành một mục, cập nhật `Trạng thái`, commit Backend, OpenAPI và ngày xác nhận trước khi FE tích hợp.

Trạng thái sử dụng:

- `OPEN`: Backend chưa triển khai hoặc contract chưa chốt.
- `BE_IN_PROGRESS`: Backend đang triển khai.
- `READY_FOR_FE`: Backend đã merge và FE có thể tích hợp.
- `RESOLVED`: FE đã tích hợp và kiểm thử E2E.
- `WONT_FIX`: Product/BE đã quyết định không làm, phải ghi lý do.

## Tổng hợp

| ID | Ưu tiên | Khu vực | Gap | Trạng thái |
|---|---|---|---|---|
| BE-GAP-001 | P0 | Email verification | Chưa có email OTP và workflow kích hoạt thủ công Receptionist → Manager | OPEN |
| BE-GAP-002 | P1 | Training Plan | Coach chưa có API xem lịch sử version | OPEN |
| BE-GAP-003 | P1 | Training Plan | Có trạng thái `ARCHIVED` nhưng không có API archive | OPEN |
| BE-GAP-004 | P1 | Training Plan | Response Coach thiếu thời điểm cập nhật/version | OPEN |
| BE-GAP-005 | P1 | Membership/Offer | Membership và public Offer response thiếu đầy đủ Benefit để FE hiển thị quyền lợi/eligibility | OPEN |
| BE-GAP-006 | P2 | Training Plan | `content` chưa có schema ổn định trong OpenAPI | OPEN |
| BE-GAP-007 | P2 | Training Plan | Chưa chốt quyền sửa giáo án của assignment cũ | OPEN |
| BE-GAP-008 | P2 | Training Plan | Update chưa có stale-version/concurrency guard | OPEN |
| BE-GAP-009 | P2 | Coach assignment | Workload capacity hiện chỉ là placeholder | OPEN |
| BE-GAP-010 | P2 | Membership Offer | Admin API thiếu detail endpoint và display data của Plan | OPEN |
| BE-GAP-011 | P3 | Membership Plan | Validation error chưa có field-level contract | OPEN |
| BE-GAP-012 | P3 | Membership Plan | Response chưa cho biết Benefit đã bị khoá | OPEN |
| BE-GAP-013 | P1 | Membership Order | Vẫn tạo được đơn từ Offer thuộc Plan INACTIVE | OPEN |

---

## BE-GAP-001 — Email OTP và kích hoạt thủ công

**Ưu tiên:** P0  
**Trạng thái:** OPEN  
**Ảnh hưởng FE:** FE chưa thể triển khai `/verify-email`, resend/change-email hoặc UI Receptionist/Manager cho kích hoạt thủ công.

### Hiện trạng đã kiểm tra

Backend hiện không có module, migration hoặc controller cho email verification, OTP, verification session, email outbox hay manual activation request. Repository cũng chưa có Spring Mail provider cho luồng này.

### Contract cần triển khai

Public/self-registration:

```http
POST /api/v1/auth/register
POST /api/v1/auth/email-verification/verify
POST /api/v1/auth/email-verification/resend
POST /api/v1/auth/email-verification/change-email
```

Receptionist:

```http
GET  /api/v1/reception/email-verification/pending-accounts?query={memberId|phone|email}
POST /api/v1/reception/email-verification/manual-activation-requests
GET  /api/v1/reception/email-verification/manual-activation-requests?status=PENDING
GET  /api/v1/reception/email-verification/manual-activation-requests/{requestId}
```

Manager:

```http
GET  /api/v1/manager/email-verification/manual-activation-requests?status=PENDING&page=0&size=20
GET  /api/v1/manager/email-verification/manual-activation-requests/{requestId}
POST /api/v1/manager/email-verification/manual-activation-requests/{requestId}/approve
POST /api/v1/manager/email-verification/manual-activation-requests/{requestId}/reject
```

### Quy tắc bắt buộc

- Self-register tạo `MEMBER / INACTIVE`, chỉ OTP hợp lệ hoặc manual approval hợp lệ mới kích hoạt.
- Receptionist chỉ tạo yêu cầu với lý do, phương thức xác minh và evidence note; không được approve/reject.
- Một Manager ACTIVE có thể approve/reject; không cần hai Manager.
- Manual approval kích hoạt account nhưng giữ `email_verified_at = NULL`; không ghi `EMAIL_VERIFIED`.
- Manager status API thông thường không được bypass pending email verification.
- Verify/resend/change-email phải có rate limit, chống enumeration, audit và transactional outbox.
- Verification session dùng HttpOnly cookie; change-email cần `X-Pending-CSRF` và Origin validation.
- List staff phải có pagination; approve/reject phải chống double-submit bằng row lock/version.
- OpenAPI và `GeneratedOpenApiTests` phải được cập nhật trước khi FE tích hợp.

### Nguồn contract chi tiết

Toàn bộ schema, migration, response, error code, security, audit và test matrix nằm tại:

`docs/email-otp-verification-implementation-plan-revised-2026-10-19.md`

Không rút gọn implementation chỉ dựa trên backlog này.

### Điều kiện chuyển sang READY_FOR_FE

- OpenAPI merge đầy đủ public và staff endpoints.
- Staging bật được feature flag với SMTP thật hoặc provider staging.
- Cookie/CSRF/CORS topology đã kiểm thử.
- Manual activation pass role, race và audit integration tests.

---

## BE-GAP-002 — Coach chưa xem được lịch sử version giáo án

**Ưu tiên:** P1  
**Trạng thái:** OPEN

### Hiện trạng

`GET /coach/members/{memberId}/training-plans` chỉ trả version mới nhất qua `TrainingPlanResponse`. Trong khi `GET /members/me/training-plans` đã trả toàn bộ `versions` cho Member.

Coach có thể tạo version mới nhưng không thể xem lại nội dung version trước để đối chiếu.

### Đề nghị contract

```http
GET /api/v1/coach/members/{memberId}/training-plans/{planId}/versions
```

Response tối thiểu:

```json
[
  {
    "id": "uuid",
    "versionNumber": 2,
    "content": {},
    "createdByAccountId": "uuid",
    "createdAt": "2026-10-20T10:00:00Z"
  }
]
```

### Security/acceptance

- Chỉ Coach ACTIVE đang có assignment hợp lệ với Member được xem.
- `planId` phải thuộc `memberId`.
- Thứ tự version phải ổn định, đề nghị mới nhất trước.
- Có test `403/404` cho Coach khác, Member khác và plan không tồn tại.

---

## BE-GAP-003 — Không có API archive giáo án

**Ưu tiên:** P1  
**Trạng thái:** OPEN

### Hiện trạng

`TrainingPlanStatus` có `ACTIVE` và `ARCHIVED`, nhưng Backend không có service/controller nào chuyển Plan sang `ARCHIVED`. Mọi Plan được tạo sẽ ở `ACTIVE` vô thời hạn.

### Đề nghị contract

Một trong hai dạng sau, cần chốt một dạng trong OpenAPI:

```http
POST /api/v1/coach/members/{memberId}/training-plans/{planId}/archive
```

hoặc:

```http
PATCH /api/v1/coach/members/{memberId}/training-plans/{planId}/status
Content-Type: application/json

{ "status": "ARCHIVED" }
```

### Quy tắc/acceptance

- Chỉ Plan `ACTIVE` mới archive được.
- Không hard delete Plan hoặc version.
- Ghi audit actor, Member, assignment, plan và thời điểm.
- Request lặp lại cần idempotent hoặc trả conflict code ổn định.
- Cần chốt có cho restore `ARCHIVED -> ACTIVE` hay không; FE không tự suy luận.

---

## BE-GAP-004 — TrainingPlanResponse thiếu timestamp cập nhật

**Ưu tiên:** P1  
**Trạng thái:** OPEN

### Hiện trạng

Response Coach có `createdAt`, `versionId` và `versionNumber` nhưng không có `updatedAt` hoặc thời điểm tạo version mới nhất. Sau update, FE chỉ có thể hiển thị thời điểm tạo Plan ban đầu.

### Đề nghị

Bổ sung ít nhất:

```json
{
  "updatedAt": "2026-10-20T10:00:00Z",
  "versionCreatedAt": "2026-10-20T10:00:00Z"
}
```

Timestamp phải là ISO-8601 UTC và được ghi trong OpenAPI.

---

## BE-GAP-005 — Membership và public Offer response thiếu đầy đủ Benefit/capability

**Ưu tiên:** P1  
**Trạng thái:** OPEN  
**Ảnh hưởng FE:** Phase 6 chưa thể pre-disable chính xác Booking, Center Visit, Personal Coaching và Training theo Plan động.

### Hiện trạng

`MembershipHistoryResponse` chỉ có Plan/Offer, giá, trạng thái và thời gian;
không có `benefitCodes` hoặc capability flags. FE không được suy quyền từ
`planCode`, tên Plan hoặc giá.

`MembershipOfferResponse` dùng cho danh sách/chi tiết Offer công khai cũng
không có `benefitCodes`. Response chỉ có hai cờ:

- `supportsBooking`
- `supportsPersonalCoaching`

Vì vậy các card gói tập hiện chỉ dựng được ba dòng tổng quát và không thể hiển
thị đúng toàn bộ quyền lợi Manager đã chọn, ví dụ `POOL_ACCESS`,
`MASSAGE_ACCESS`, `OUTDOOR_SPORT_ACCESS`, `TRAINING_PLAN`,
`TRAINING_RESULT`, `TRAINING_FEEDBACK`. Việc gộp nhiều Benefit vào hai boolean
cũng làm nội dung card có thể sai: có Personal Coaching không đồng nghĩa chắc
chắn có đủ Training Plan/Result/Feedback.

### Đề nghị

Bổ sung vào response Membership hiện tại một contract ổn định, ưu tiên:

```json
{
  "benefitCodes": [
    "CENTER_ACCESS",
    "CLASS_BOOKING",
    "PERSONAL_COACHING",
    "TRAINING_PLAN",
    "TRAINING_RESULT",
    "TRAINING_FEEDBACK"
  ]
}
```

Nếu dùng capability flags thay thế, phải bao phủ mọi Benefit đang điều khiển UI và có chiến lược mở rộng; không chỉ có `supportsBooking` và `supportsPersonalCoaching`.

Áp dụng tối thiểu cho:

- `GET /api/v1/membership-offers`.
- `GET /api/v1/membership-offers/{offerId}`.
- Membership hiện tại của Member.
- Membership history được Manager/Receptionist/Member dùng.
- Các response profile/dashboard đang dùng để quyết định hiển thị action.

Public Offer response nên trả ít nhất:

```json
{
  "planCode": "PREMIUM",
  "planDisplayName": "Premium",
  "benefitCodes": [
    "CENTER_ACCESS",
    "POOL_ACCESS",
    "MASSAGE_ACCESS"
  ]
}
```

Nếu UI cần tên/mô tả thân thiện mà không được phép gọi Manager catalogue, BE
nên trả thêm danh sách snapshot/display DTO:

```json
{
  "benefits": [
    {
      "code": "POOL_ACCESS",
      "displayName": "Sử dụng hồ bơi",
      "description": "Cho phép đặt Session thuộc Discipline yêu cầu hồ bơi"
    }
  ]
}
```

Không để FE gọi `/manager/membership-plans` từ màn Member/Public và không suy
quyền từ tên hoặc mã gói.

Backend vẫn phải kiểm tra lại Benefit tại thời điểm mutation; dữ liệu này chỉ giúp FE hiển thị chính xác.

---

## BE-GAP-006 — Training Plan content chưa có schema ổn định

**Ưu tiên:** P2  
**Trạng thái:** OPEN

### Hiện trạng

`CreateTrainingPlanRequest` và `UpdateTrainingPlanRequest` dùng `Map<String, Object> content`. OpenAPI không định nghĩa các key, type, giới hạn hoặc khả năng mở rộng. FE hiện dùng quy ước tạm:

```json
{
  "goal": "string",
  "schedule": "string",
  "exercises": ["string"],
  "notes": "string"
}
```

### Yêu cầu BE/Product chốt

- Hoặc thay bằng typed DTO/versioned schema.
- Hoặc chính thức hóa JSON schema ở OpenAPI, gồm required/optional, maximum size và unknown-field policy.
- Nếu cần tương thích dữ liệu cũ, response phải giữ nguyên unknown fields và ghi rõ version schema.

Không chốt schema sẽ khiến FE/web/mobile ghi dữ liệu khác cấu trúc và khó migrate.

---

## BE-GAP-007 — Chưa chốt quyền sửa Plan từ assignment cũ

**Ưu tiên:** P2  
**Trạng thái:** OPEN

### Hiện trạng

Update hiện kiểm tra Coach đang có assignment ACTIVE với Member, sau đó tìm Plan bằng `planId + memberId`. Backend không kiểm tra `plan.coachAssignmentId` có trùng assignment hiện tại hay không.

Kết quả: Coach mới có thể cập nhật một Plan do Coach/assignment cũ tạo.

### Cần quyết định

- **Cho phép tiếp quản:** giữ behavior, bổ sung test và ghi rõ audit/version creator.
- **Không cho phép:** từ chối bằng `403/409` với error code ổn định và yêu cầu Coach mới tạo Plan mới.

FE không tự chặn cho đến khi Product/BE chốt rule.

---

## BE-GAP-008 — Update giáo án chưa có stale-version guard

**Ưu tiên:** P2  
**Trạng thái:** OPEN

### Hiện trạng

Backend lock row khi update và tăng version tuần tự, nhưng request không gửi version mà Coach đang sửa. Hai tab cùng mở version 1 có thể lần lượt tạo version 2 và 3; request thứ hai không biết dữ liệu đã thay đổi.

### Đề nghị

Thêm một trong hai:

- `expectedVersionNumber` trong update request; hoặc
- `If-Match`/ETag.

Nếu version hiện tại khác expected version, trả:

```http
409 TRAINING_PLAN_VERSION_CONFLICT
```

Response conflict nên trả `currentVersionNumber` để FE yêu cầu reload.

---

## BE-GAP-009 — Coach workload capacity là placeholder

**Ưu tiên:** P2  
**Trạng thái:** OPEN

### Hiện trạng

`GET /manager/coaches/assignment-workloads` luôn trả:

```json
{
  "maximumMemberCount": null,
  "availableForAssignment": true
}
```

Frontend hiện chỉ hiển thị `activeMemberCount` để tham khảo và không dùng hai field trên làm rule.

### Cần BE/Product chốt

- Nếu không có giới hạn tải HLV: bỏ hai field placeholder khỏi contract hoặc ghi rõ chúng không có semantics.
- Nếu có giới hạn: định nghĩa nguồn cấu hình, validation khi assign/reassign, error code khi quá tải và giá trị thực trong workload response.

FE chỉ dùng capacity để disable action sau khi Backend thực thi cùng rule trong mutation.

---

## BE-GAP-010 — Admin Membership Offer API chưa đủ cho detail UX

**Ưu tiên:** P2  
**Trạng thái:** OPEN

### Hiện trạng

Manager chỉ có:

```http
GET   /manager/membership-offers
POST  /manager/membership-offers
PATCH /manager/membership-offers/{id}
```

Không có `GET /manager/membership-offers/{id}`. FE phải tải toàn bộ danh sách rồi tìm Offer theo ID. `MembershipOfferAdminResponse` có `planCode` và `status` nhưng không có `planDisplayName` hoặc Benefit/capability của Plan.

### Đề nghị

```http
GET /api/v1/manager/membership-offers/{offerId}
```

Admin response nên có tối thiểu:

```json
{
  "offerId": "uuid",
  "planCode": "PREMIUM",
  "planDisplayName": "Premium",
  "status": "ACTIVE",
  "name": "...",
  "description": "...",
  "priceAmount": 1000000,
  "currencyCode": "VND",
  "durationDays": 30
}
```

Nếu FE cần capability, có thể join từ Plan API; không bắt buộc duplicate nếu team muốn giữ response gọn.

---

## BE-GAP-011 — Membership Plan validation chưa map theo field

**Ưu tiên:** P3  
**Trạng thái:** OPEN

### Hiện trạng

Plan validation trả `MEMBERSHIP_PLAN_VALIDATION_ERROR` với detail string, không có `errors` theo field. FE chỉ có thể hiển thị lỗi form chung thay vì gắn vào `code`, `displayName` hoặc `benefitCodes`.

### Đề nghị

Giữ error code hiện tại nhưng bổ sung chuẩn đang dùng ở các form khác:

```json
{
  "code": "MEMBERSHIP_PLAN_VALIDATION_ERROR",
  "errors": {
    "benefitCodes": ["must contain only existing ACTIVE benefits"]
  }
}
```

Conflict vẫn giữ code riêng:

- `MEMBERSHIP_PLAN_CODE_CONFLICT`
- `MEMBERSHIP_PLAN_BENEFITS_LOCKED`
- `MEMBERSHIP_PLAN_NOT_FOUND`

---

## BE-GAP-012 — Membership Plan response chưa cho biết quyền lợi đã bị khoá

**Ưu tiên:** P3  
**Trạng thái:** OPEN

### Hiện trạng

Backend chỉ kiểm tra `orders.existsByPlanCodeSnapshot(code)` khi nhận PATCH đổi
`benefitCodes`. `MembershipPlanResponse` không có trường thể hiện trước rằng loại
gói đã phát sinh đơn và quyền lợi không còn được sửa.

FE vì vậy phải cho phép chỉnh lần đầu, chờ lỗi
`MEMBERSHIP_PLAN_BENEFITS_LOCKED`, rồi mới khoá các checkbox và yêu cầu Manager
lưu lại riêng tên/trạng thái.

### Đề nghị

Bổ sung một cờ chỉ đọc trong response list/detail:

```json
{
  "code": "PREMIUM",
  "benefitsLocked": true
}
```

Cờ này chỉ phục vụ UX; Backend vẫn phải giữ conflict check khi PATCH để tránh
race condition.

---

## BE-GAP-013 — Vẫn tạo được đơn từ Offer thuộc Plan đã INACTIVE

**Ưu tiên:** P1  
**Trạng thái:** OPEN

### Hiện trạng

API public list/detail đã ẩn Offer khi `MembershipPlan.status = INACTIVE`.
Tuy nhiên, luồng tạo đơn trong `MembershipOrderService` chỉ gọi:

```java
membershipOfferRepository.findByIdAndStatus(offerId, MembershipOfferStatus.ACTIVE)
```

Query này không kiểm tra trạng thái của Plan. Sau đó service có khoá Plan bằng
`findByPlanCodeForUpdate(...)`, nhưng cũng chỉ kiểm tra Plan tồn tại, không yêu
cầu `status = ACTIVE`.

Vì vậy client đã lưu `offerId`, request cũ đang mở, hoặc người dùng gọi API trực
tiếp vẫn có thể tạo đơn mới từ một Offer ACTIVE thuộc Plan đã INACTIVE. Việc FE
không còn hiển thị Offer chỉ giảm khả năng xảy ra, không bảo vệ business rule.

### Cách tái hiện

1. Tạo Plan ACTIVE và một Offer ACTIVE thuộc Plan đó.
2. Lưu lại `offerId`.
3. Chuyển Plan sang INACTIVE nhưng giữ Offer ACTIVE.
4. Gọi API tạo Membership Order với `offerId` đã lưu.
5. Hiện tại đơn vẫn có thể được tạo.

### Đề nghị

- Trong luồng tạo đơn, lấy Offer bằng query yêu cầu đồng thời
  `offer.status = ACTIVE` và `offer.plan.status = ACTIVE`, ví dụ tái sử dụng
  `findByIdAndStatusAndActivePlan(...)`.
- Sau khi khoá Plan, kiểm tra lại `plan.status == ACTIVE` trong cùng transaction
  để chống race condition khi Manager vô hiệu hoá Plan đồng thời với lúc tạo
  đơn.
- Trả lỗi business ổn định, ví dụ `MEMBERSHIP_OFFER_NOT_AVAILABLE`, thay vì để
  FE phụ thuộc vào thông điệp chung.
- Bổ sung integration test cho cả Member và Receptionist create-order:
  Offer ACTIVE + Plan INACTIVE phải bị từ chối và không tạo Order/Payment.

### Acceptance criteria

- Không thể tạo đơn mới khi Offer hoặc Plan không ACTIVE.
- Đơn/Membership đã thanh toán trước đó không bị ảnh hưởng khi Plan chuyển
  INACTIVE.
- Không có race cho phép tạo đơn lọt qua trong lúc Plan đang bị vô hiệu hoá.

---

## Những finding đã loại khỏi backlog

Không đưa các finding sau vào danh sách OPEN vì Backend hiện tại đã có xử lý hoặc chúng là việc FE:

- Room impact `RESCHEDULE` đã kiểm tra không overlap chính impact interval và suspension hiện hữu.
- Receptionist Session catalogue cho booking đã tồn tại trong contract hiện tại.
- Membership Offer admin response hiện đã có `status`; comment FE cũ nói thiếu status là stale và sẽ sửa trong Phase 5.
- Discipline/Class blocker rendering, age validation và các selector BASIC/PLUS hiện tại là việc Frontend.

## Quy trình cập nhật

Khi Backend báo đã sửa một mục:

1. Ghi commit/PR Backend ngay dưới mục tương ứng.
2. Kiểm tra source, migration, security và OpenAPI thay vì chỉ dựa vào mô tả.
3. Chuyển sang `READY_FOR_FE` khi contract đã merge và test Backend pass.
4. Sau khi FE tích hợp và browser/E2E pass, chuyển sang `RESOLVED`.
5. Nếu phát hiện gap mới, thêm ID kế tiếp; không ghi đè hoặc tái sử dụng ID cũ.
