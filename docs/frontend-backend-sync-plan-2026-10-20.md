# Frontend–Backend Sync Plan — Backend update 20/10/2026

## 1. Baseline đã đối chiếu

- Backend local `main`: `239b72f` (merge chứa remote `main` `70b2da1`).
- Frontend `main`: `b8dc66c` và working tree Phase 7 hiện tại.
- Các Backend commit cần tích hợp:
  - `70b2da1` — email OTP và manual activation.
  - `ae86738` — hoàn thiện Training Plan và Coach capacity.
  - `715ded5` — chặn order khi Offer/Plan không còn ACTIVE.
- Phạm vi plan này chỉ thay đổi Frontend. Backend là read-only; các thiếu sót
  Backend tiếp tục ghi trong `backend-api-gap-backlog-2026-10-20.md`.

## 2. Kết luận sau khi kiểm tra Backend mới

### Contract đã sẵn sàng để FE tích hợp

| Nhóm | Gap cũ | Trạng thái |
|---|---|---|
| Email OTP + manual activation | BE-GAP-001 | READY_FOR_FE |
| Training Plan version history | BE-GAP-002 | READY_FOR_FE |
| Archive Training Plan | BE-GAP-003 | READY_FOR_FE |
| Training timestamps | BE-GAP-004 | READY_FOR_FE |
| Training content schema v1 | BE-GAP-006 | READY_FOR_FE |
| Coach tiếp quản Plan cũ | BE-GAP-007 | READY_FOR_FE |
| Stale-version guard | BE-GAP-008 | READY_FOR_FE |
| Coach workload/capacity | BE-GAP-009 | READY_FOR_FE |
| Reject order của Plan/Offer inactive | BE-GAP-013 | READY_FOR_FE |

### Gap Backend vẫn còn mở

- BE-GAP-005: Membership/public Offer chưa trả đầy đủ Benefit.
- BE-GAP-010: Manager Offer chưa có detail API riêng/display data đầy đủ.
- BE-GAP-011: Membership Plan validation chưa có field-level errors.
- BE-GAP-012: Membership Plan chưa trả `benefitsLocked`.
- BE-GAP-014: Discipline/Session chưa trả `requiredBenefitCodes`.
- BE-GAP-015: Audit actor chưa snapshot danh tính.
- BE-GAP-016: Staff self-profile chưa audit và chưa xử lý race unique ổn định.
- BE-GAP-017: OpenAPI manual activation chưa mô tả đủ response fields và list
  query parameters dù implementation đã có.

## 3. Thứ tự triển khai Frontend

### Sync 1 — Cập nhật API services và error contract

Mục tiêu: tạo lớp gọi API đúng contract trước khi làm UI.

1. Mở rộng `authService.js`:
   - `verifyEmail({ email, otp })`.
   - `resendVerificationEmail({ email })`.
   - `changePendingEmail({ newEmail, csrfToken })`, gửi header
     `X-Pending-CSRF`; tiếp tục dùng `withCredentials`.
2. Tạo service manual activation dùng authenticated `api`:
   - Receptionist search/create/list/detail.
   - Manager list/detail/approve/reject.
3. Mở rộng `trainingService.js`:
   - list versions;
   - archive Plan;
   - update gửi `expectedVersionNumber`.
4. Sửa chú thích và consumer của `coachAssignmentService.js` để coi
   `maximumMemberCount` và `availableForAssignment` là dữ liệu thật.
5. Thêm mapping `MEMBERSHIP_OFFER_NOT_AVAILABLE` cho Member checkout,
   Receptionist bank-transfer order và cash payment.

Acceptance:

- Request path/body/header khớp Backend source/OpenAPI.
- Không gửi field dư vì các DTO mới từ chối unknown fields.
- Service tests bao phủ success, 409, 429 và response rỗng/paged không hợp lệ.

### Sync 2 — Self-registration và trang xác thực email

1. Sửa `RegisterPage` dùng response thay vì luôn chuyển thẳng tới login:
   - `verificationRequired=false`, `status=ACTIVE`: giữ behavior hiện tại để
     tương thích khi feature flag Backend đang tắt.
   - `verificationRequired=true`, `status=INACTIVE`: chuyển tới
     `/verify-email` cùng email đã nhập và metadata thời gian.
   - `409 EMAIL_VERIFICATION_PENDING`: cũng chuyển về luồng verify, dùng các
     timestamp trong ProblemDetail.
2. Tạo guest route `/verify-email` theo chuẩn dự án:
   - RHF + Zod;
   - email và OTP 6 chữ số;
   - countdown dựa trên chênh lệch `serverTime`, không dùng đồng hồ client làm
     nguồn tuyệt đối;
   - resend chỉ bật khi cooldown kết thúc;
   - verify thành công chuyển `/login?verified=1`;
   - đổi email qua form riêng và cập nhật `csrfToken` mới từ response.
3. Lưu state tối thiểu trong `sessionStorage` để F5 không làm mất email,
   timestamps và pending CSRF. Không lưu OTP hoặc pending-session cookie.
4. Error UX cần map:
   - `INVALID_OR_EXPIRED_OTP`;
   - `INVALID_PENDING_SESSION`;
   - `INVALID_PENDING_ORIGIN`;
   - `EMAIL_CHANGE_LIMIT_EXCEEDED`;
   - `EMAIL_ALREADY_EXISTS`;
   - `RATE_LIMITED` và header `Retry-After`.

Lưu ý môi trường:

- Backend mặc định `EMAIL_VERIFICATION_ENABLED=false`; khi tắt, đăng ký vẫn
  tạo account ACTIVE. FE phải hỗ trợ cả hai response, không hard-code OTP luôn
  bật.
- E2E OTP chỉ chạy được khi BE bật feature flag, cấu hình SMTP và crypto keys.

Acceptance:

- Luồng register hoạt động ở cả feature flag ON/OFF.
- F5 trang verify vẫn giữ được trạng thái cần thiết.
- Không thể submit OTP sai định dạng; resend chống double-click.
- Verify thành công không auto-login, đúng contract Backend.

### Sync 3 — Receptionist tạo yêu cầu kích hoạt thủ công

1. Thêm menu và routes trong khu vực Receptionist.
2. Màn tra cứu pending account theo đúng một trong ba identifier:
   `memberId`, phone hoặc email.
3. Form tạo yêu cầu dùng RHF + Zod với đúng enum Backend:
   - `reasonCode`: `EMAIL_DELIVERY_FAILED`, `MEMBER_CANNOT_ACCESS_EMAIL`,
     `ACCESSIBILITY_SUPPORT`, `OTHER`;
   - `verificationMethod`: `IN_PERSON_GOVERNMENT_ID_CHECK`,
     `IN_PERSON_PROFILE_AND_REGISTERED_PHONE_MATCH`,
     `OTHER_APPROVED_PROCEDURE`;
   - `reasonDetail` tối đa 1000;
   - `evidenceNote` tối đa 2000;
   - `identityChecked` bắt buộc `true`.
4. Màn danh sách của chính Receptionist có filter status, pagination và detail.
5. Map các lỗi `PENDING_ACCOUNT_NOT_FOUND`,
   `MANUAL_ACTIVATION_NOT_ELIGIBLE`, `MANUAL_ACTIVATION_REQUEST_PENDING`,
   `RATE_LIMITED`.

Acceptance:

- Receptionist chỉ thấy request do chính mình tạo như Backend quy định.
- Không cho gửi request nếu chưa xác nhận kiểm tra danh tính trực tiếp.
- UI hiển thị rõ trạng thái PENDING/APPROVED/REJECTED/CANCELLED/EXPIRED.

### Sync 4 — Manager duyệt yêu cầu kích hoạt

1. Thêm menu/routes Manager cho queue manual activation.
2. Danh sách có status filter và pagination.
3. Detail hiển thị lý do, phương pháp và evidence note; approve/reject đều yêu
   cầu `decisionNote` (RHF + Zod, tối đa 1000).
4. Sau mutation phải dùng response làm nguồn trạng thái, disable action nếu
   request không còn PENDING và chống double-submit.
5. Map `MANUAL_ACTIVATION_REQUEST_NOT_FOUND`,
   `MANUAL_ACTIVATION_REQUEST_DECIDED`, `MANUAL_ACTIVATION_NOT_ELIGIBLE`,
   `RATE_LIMITED`.

Acceptance:

- Manager có thể approve hoặc reject một mình đúng rule đã chốt.
- Approve xong account đăng nhập được; reject không vô hiệu luồng OTP.
- Hai lần bấm/2 tab không hiển thị thành công giả khi Backend trả conflict.

### Sync 5 — Hoàn thiện Training Plan Phase 4

1. Form create/edit giữ RHF + Zod và chuẩn hóa content schema v1:
   - `goal`, `schedule`, `notes`: string tối đa 4000;
   - `exercises`: tối đa 100 item, mỗi item không rỗng và tối đa 500 ký tự;
   - không gửi key ngoài schema.
2. Khi edit, gửi `expectedVersionNumber` từ Plan đang hiển thị.
3. Khi Backend trả `TRAINING_PLAN_VERSION_CONFLICT`:
   - hiển thị dữ liệu đã bị thay đổi;
   - dùng `currentVersionNumber` để yêu cầu tải lại;
   - không tự ghi đè hoặc tự submit lại.
4. Thêm lịch sử versions, newest-first, gồm creator và `createdAt`.
5. Thêm archive action có confirm; archive lặp lại được coi là idempotent;
   không tạo nút restore vì Backend không hỗ trợ.
6. Hiển thị `updatedAt`, `versionCreatedAt`, `contentSchemaVersion` và trạng
   thái ACTIVE/ARCHIVED.
7. Coach hiện tại được sửa Plan từ assignment cũ; FE không chặn theo
   `coachAssignmentId` cũ.

Acceptance:

- Create/update payload pass validator Backend.
- Conflict không làm mất nội dung Coach đang nhập.
- Archived Plan không còn action edit nhưng vẫn xem được version history.

### Sync 6 — Coach assignment capacity

1. Hiển thị `activeMemberCount / maximumMemberCount` trong danh sách chọn HLV.
2. Disable lựa chọn khi `availableForAssignment=false`, trừ trường hợp cần
   hiển thị Coach hiện tại ở chế độ chỉ đọc.
3. Backend vẫn là nguồn quyết định cuối cùng; map error capacity từ mutation và
   reload workloads sau assign/reassign.
4. Xóa comment/fallback cũ nói hai field là placeholder.

Acceptance:

- HLV đầy tải không thể được chọn từ UI.
- Race giữa hai Manager vẫn hiển thị lỗi Backend đúng, không báo thành công giả.

### Sync 7 — Membership order unavailable

1. Thêm `MEMBERSHIP_OFFER_NOT_AVAILABLE` vào message map ở:
   - Member checkout;
   - Receptionist tạo đơn chuyển khoản;
   - Receptionist thu tiền mặt.
2. Khi gặp lỗi:
   - thông báo gói vừa ngừng bán/loại gói đã ngừng hoạt động;
   - clear lựa chọn stale;
   - reload danh sách Offer active;
   - không tự retry mutation.

Acceptance:

- Tab cũ chứa `offerId` không hiển thị lỗi kỹ thuật thô.
- Existing paid Membership không bị FE ẩn/chặn chỉ vì Plan sau đó INACTIVE.

## 4. Test và rollout

### Automated tests

- Unit/service tests cho toàn bộ API wrapper mới.
- Component tests cho OTP countdown, resend, change-email và error mapping.
- Component tests cho manual activation role-specific actions.
- Training tests cho schema v1, version conflict và archive.
- Assignment tests cho capacity.
- Regression checkout/cash/order cho error mới.

### Browser matrix tối thiểu

1. Register khi email verification OFF.
2. Register → OTP sai → resend → OTP đúng khi ON.
3. Register → đổi email → OTP email mới.
4. Receptionist tạo request → Manager reject.
5. Receptionist tạo request khác → Manager approve → Member login.
6. Coach create → update → xem versions → archive.
7. Hai tab edit cùng Plan tạo stale-version conflict.
8. Manager assign vào Coach còn chỗ và Coach đầy tải.
9. Member/Receptionist dùng Offer stale sau khi Plan bị deactivate.

### Điều kiện hoàn thành

- FE lint/build/test pass.
- Browser regression pass cho bốn role.
- BE-GAP-001/002/003/004/006/007/008/009/013 chỉ chuyển `RESOLVED` sau khi
  các UI trên tích hợp và E2E pass.
- Không đóng BE-GAP-017 chỉ dựa trên việc FE gọi được API; cần Backend sửa
  OpenAPI trước.

## 5. Phạm vi chưa làm trong đợt sync này

Không dựng giả dữ liệu hoặc hard-code rule để che các gap 005, 010–012,
014–016. FE tiếp tục giữ fallback an toàn hiện tại và chờ contract Backend.
