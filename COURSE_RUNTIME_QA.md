# Course Booking — kiểm chứng Docker và bàn giao FE

Backend được ghim tại `12fa1df7b651f40eb770502139a738a701339c8d` (backend PR #202). FE kế thừa PR #74 (`43d1a63`); SHA FE chính xác của từng lượt nằm trong artifact `sources.json`, kèm cờ checkout dirty. GitHub Actions chạy lại trên head PR và squash SHA; ledger ngoài repo ghi kết quả merge/Main CI thực tế.

## Phát hiện và thay đổi

| Phát hiện | Xử lý / bằng chứng |
|---|---|
| Cash thành công nhưng GET order lỗi | API cash trả **CourseEnrollmentResponse**, không phải CoursePaymentResponse. FE chuyển đơn sang PAID/ENROLLED ngay khi nhận enrollment, đóng modal; tải lại chỉ GET. Runtime tái hiện đỏ trước sửa; mock dùng đúng DTO và runtime đều kiểm POST một lần. |
| POST chưa rõ kết quả | Giữ key, không báo thành công; runtime chặn đúng request đầu rồi retry cùng key. Crash sau commit/trước response kiểm riêng bằng JVM thật ở BE. |
| Lịch đăng ký có 3 dòng cho 2 đơn vị sau makeup | Màn đăng ký và trang Run công khai chỉ hiển thị SCHEDULED/MAKEUP_SCHEDULED/COMPLETED. Tổng buổi lấy totalUnits, không đếm bản ghi. Runtime đỏ 3 thay vì 2 trước sửa. Lịch sử enrollment và quan hệ original/replacement không bị sửa. |
| Panel Reception sau rút/hủy/chuyển | Runtime xác minh nút rút và Run đích cập nhật không reload trang, đúng Member. Không thêm sửa nghiệp vụ nơi test đã đạt. |
| Snapshot/legacy/quyền học/cảnh báo | UI thật phân biệt REQUEST_TIME với UNAVAILABLE, pending tạm ngừng; hủy khôi phục, transfer có cảnh báo chênh lệch riêng. Không đổi chính sách 70%/80%, G01/G10. |
| G15 và cấu hình ngân hàng | Dùng API Course riêng, checksum QA đúng với snapshot giả. Không dùng cấu hình hoặc chuyển khoản thật. |

## Chạy lại

Cần JDK 21+, Maven, Node 22+, Docker Linux containers. Checkout backend đúng SHA trên ở thư mục riêng. Không dùng `mvn clean` hoặc DB nghiệp vụ.

```powershell
# Trong checkout backend đã ghim
mvn -ntp test-compile dependency:build-classpath '-Dmdep.includeScope=test' '-Dmdep.outputFile=target/qa-classpath.txt'
# Trong frontend
npm ci
npx playwright install chromium
npm test
npm run lint
npm run build
npm run test:course-ui
$env:COURSE_QA_BACKEND = 'DUONG_DAN_CHECKOUT_BACKEND_DA_GHIM'
npm run test:course-runtime
```

Không chạy hai suite Playwright cùng lúc trong một checkout: các output mặc định có thể bị dọn. CI dùng job riêng. Runtime có config riêng, không `route.fulfill` endpoint nghiệp vụ; chỉ `route.abort` cho hai ca mạng được chỉ định.

Runner tạo PostgreSQL 17 mới, chạy toàn bộ Flyway, dùng launcher JVM test-only của BE, FE tại 127.0.0.1:5189. Lớp fixture FE bổ sung lịch sử legacy ban đầu: tạm tắt **chỉ trigger snapshot** trong một transaction seed, khôi phục và assert trigger đã bật trước khi phát environment.json. Đây là fixture lịch sử giả, không phải bằng chứng nâng cấp migration; mọi chuyển trạng thái cần kiểm sau setup đi qua API/UI. Không có điều khiển test trong production binary.

Expiry scheduler được trì hoãn riêng trong môi trường UI để kiểm quyết định FAILED trước scheduler một cách xác định. Các race expiry/scheduler vẫn chạy đầy đủ trong PostgreSQL integration của BE. Scheduler completion chạy thật; không gán COMPLETED vào fixture runtime. Clock chỉ thay trong test launcher qua file nguyên tử; không đổi giờ hệ điều hành. Email trỏ loopback port 1; thông tin ngân hàng và chứng từ đều giả. Không gọi dịch vụ ngân hàng để chuyển tiền.

## Bằng chứng theo nhóm

| Nhóm | Suite / tiêu chí kiểm | Mức bằng chứng |
|---|---|---|
| QA-01 | PaymentFlowIntegrationTests: manualCourseTransactionCannotBeReusedByMembershipOrAnotherCourse; courseWebhookTransactionCannotBeReusedByManualMembershipReconciliation; manualMembershipReconciliationTransactionCannotFulfillCourse; concurrentMembershipReconciliationAndCourseWebhookShareProviderClaim | PostgreSQL, hai chiều, provider claim và không tạo entitlement cho bên thua |
| QA-02 | concurrentCourseReconciliationAndWebhookOnlyFulfillOnce; concurrentCourseCashAndReconciliationDoNotDuplicateEnrollment; concurrentCourseExpiryAndFailedReconciliationExpireOnlyOnce; ba ca *PreserveEitherFirstWinner | Transaction thật/barrier; cả hai thứ tự thắng. Không chứng nhận mọi lịch xen kẽ có thể có |
| QA-03 | courseReconciliationAuditFailureRollsBackTheEntireDecision; manualCourseAllocationOrOutboxFailureRollsBackThenRetries; courseWebhookAllocation/Audit/OutboxFailureRollsBack* | Rollback tiền, hold, enrollment/allocation, provider claim, idempotency, audit/outbox; retry một kết quả |
| QA-04 | CourseCrashRecoveryIntegrationTests | Kill JVM sở hữu trước commit và sau commit/trước response; restart cùng DB, GET/replay, payload khác 409, số artifact không tăng |
| QA-05 | CourseWithdrawalIntegrationTests + CourseCoachSessionIntegrationTests; z-time.spec.js | UI ghi Có mặt; API trước/ngoài cửa sổ 409, sai assignment/pending 404, check-in pending 409; Course-only không vào gym, Membership Member B độc lập vẫn dùng được |
| QA-06 | CourseWithdrawalIntegrationTests; z-time.spec.js | PostgreSQL race cancel/approve/reject; runtime 7/10 chốt 280000, duyệt ở 6/10/sau completion giữ nguyên; gửi ở 6/10 hoàn 0, cancel/reject không tạo buổi bù |
| QA-07 | CourseScheduleChangeIntegrationTests (bao gồm legacy/makeup/auto-completion/refund), CourseRunClosureIntegrationTests; child scheduler SYSTEM_CLOCK; z-time.spec.js | Spring scheduler thật; pending snapshot không chặn completion; chi trước completion 409, sau completion vẫn approve–disburse–verify; FAILED/RETURNED qua API |
| Cash + refresh | course-runtime.spec.js | UI SYSTEM_CLOCK: GET lỗi không gửi lại cash, retry POST cùng key, enrollment duy nhất |
| Đối soát | course-runtime.spec.js + z-time.spec.js | Manager PAID UI, Reception FAILED UI, sai amount 400; owner 200/Member khác 403/Coach 403/inactive login bị chặn; replay cùng quyết định, đổi payload 409 |
| G14 / waitlist / transfer | proxy-transfer.spec.js | Join/leave setup API proxy, accept UI Reception, sai owner 404; phản hồi lịch API proxy; chấp nhận transfer UI, đơn tăng 200000 được thu, giảm 200000 được hoàn CASH/verify; panel đúng Member cập nhật |
| Lịch / legacy | schedule.spec.js + course-runtime.spec.js | Lịch hiệu lực 2 đơn vị sau makeup; API giữ liên kết buổi gốc/bù; UI legacy không biến thiếu snapshot thành 0 hoặc “tính lại khi duyệt” |
| Contract/schema | BE exact-SHA unit + 4 integration shards | Static/generated OpenAPI, migration suites trong selector hiện có; runtime chạy Flyway mới. PR này không sửa migration/API |

Local trước push: **25 unit, 14 UI mock, 10 runtime**; lint còn 6 warnings có sẵn, build đạt. BE #202: 162 PostgreSQL cases trong nhóm trọng tâm, 974 non-container; Push/PR/Main unit + 4/4 shards và security đạt. Test local ban đầu lỗi selector/HTTP expectation được phân loại là lỗi test, không coi là regression nghiệp vụ.

Mỗi test runtime có trạng thái Playwright và attachment HTTP đã bỏ token/body đăng nhập: đường dẫn, method, expected/actual status, error code. `verified-state` ghi invariant chính; `database-counts.json` kiểm mỗi order allocation và tối đa một payment PAID/enrollment/audit đối soát/thông báo ghi danh mỗi đơn. `sources.json` ghi cặp SHA và clock. Report JSON và screenshot lỗi được CI upload; không upload owner log/JDBC URL/token. Trace runtime tắt để tránh lưu credential phiên thật; suite mock giữ trace lỗi.

## Điều kiện bàn giao

Chỉ gắn FIXED_VERIFIED cho các lỗi FE có runtime tương ứng đạt trên head/squash SHA sửa. `QA_COMPLETE_ISOLATED` yêu cầu tất cả Git gates và runtime cuối cùng đạt; không suy từ một Maven build xanh. Tài liệu này không tự xác nhận merge/Main CI tương lai — dùng ledger và artifact đúng SHA.

SYSTEM_CLOCK kiểm thanh toán/UI và child scheduler ngắn hợp lệ. CONTROLLED_CLOCK kiểm các mốc dài, không phải nghiệm thu thời gian thực trên deployment. Không deploy production, không ngân hàng thật, không xử lý tiền chuyển muộn. Source GAPS/HANDOFF giữ ngoài commit. Rollback FE có thể revert commit; không rollback schema vì không có migration mới.
