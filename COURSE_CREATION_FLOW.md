# Luồng tạo và vận hành khóa học từ bộ môn

Trích từ source FE/BE local ngày 05/11/2026; cập nhật bước 6–8 sau khi nối lịch tuần. Kết quả kiểm thử UI mới xem COURSE_WEEKLY_SCHEDULE_QA.md.

## 1. Các cấp dữ liệu
Bộ môn (Discipline) → Khóa học (Course) → Đợt mở (CourseRun) → Buổi học (CourseSession).
Ví dụ: Swimming → Bơi cơ bản → Bơi cơ bản tháng 12 → Buổi 1, 2, ... 8.
Một bộ môn có nhiều khóa; một khóa có nhiều đợt; mỗi đợt có lịch, học phí, sĩ số và học viên riêng.

## 2. Tạo bộ môn
Quản lý → Vận hành lớp học → Bộ môn → Tạo bộ môn.
Nhập tên (bắt buộc, tối đa 150 ký tự), mô tả và các quyền lợi yêu cầu. BE trim tên, chặn tên trùng, khởi tạo ACTIVE, lưu audit DISCIPLINE_CREATED.
Quyền lợi thêm phải tồn tại, ACTIVE và không trùng. CLASS_BOOKING là quyền cơ sở được mô hình bộ môn thêm vào; không phải người quản lý tự bỏ chọn.
Lưu ý: cấu hình quyền lợi bộ môn phục vụ đặt lớp thường; CourseOrderService hiện không kiểm tra gói tập hoặc quyền lợi khi mua khóa học riêng.
Code có quy tắc legacy chặn tạo mới tên Yoga, dù placeholder FE vẫn ghi Yoga.

## 3. Chuẩn bị HLV và phòng
Có tài khoản HLV ACTIVE và phòng ACTIVE, đủ sức chứa. Form tạo đợt chọn HLV chính và phòng để sinh lịch tuần; sau đó vẫn có thể chỉnh từng buổi.
Không cần tạo SportClass/lớp tập thường trước khi tạo Course.

## 4. Tạo khóa học
Quản lý → Khóa học → Danh mục khóa học → Tạo khóa học.
Trường: mã (50), tên (200), bộ môn ACTIVE, số đăng ký tối thiểu mặc định (>0 trên FE), mô tả (2000), ảnh URL (500) hoặc chọn JPEG/PNG từ máy (tối đa 5 MiB).
BE chuyển mã thành chữ hoa, kiểm tra mã duy nhất, tạo DRAFT, ghi audit.
Ảnh được upload riêng; URL được gửi trong payload tạo/sửa khóa.
Khóa mới chưa có học phí, lịch, phòng hoặc học viên. Những dữ liệu đó thuộc đợt mở.
Chỉnh sửa hiện cho thay tên/mô tả/ảnh/số tối thiểu; không đổi mã/bộ môn trong form này.

## 5. Công khai khóa học
Chi tiết khóa → Công khai: DRAFT → PUBLISHED. Khóa xuất hiện trong danh mục công khai và được chọn khi tạo đợt.
Ngừng hoạt động: PUBLISHED → INACTIVE. Có thể công khai lại. Lưu trữ áp dụng từ DRAFT hoặc INACTIVE.
Ngừng hoạt động/Lưu trữ nay đồng thời hủy các đợt DRAFT/OPEN_FOR_REGISTRATION/CONFIRMED có giờ khai giảng còn ở tương lai, cùng lịch buổi dự kiến. Đợt đã bắt đầu giữ nguyên. Đơn chờ hết hạn; enrollment đã thanh toán đi theo luồng yêu cầu hoàn tiền. Công khai lại khóa không tự hồi phục đợt đã hủy. Chi tiết thay đổi và test: backend/docs/COURSE_CANCELLATION_CASCADE.md.
Đây chưa phải mở đăng ký cho một đợt.
Nhánh duyệt còn tồn tại trong BE: PENDING_APPROVAL → DRAFT khi duyệt, hoặc REJECTED khi từ chối. Tuy nhiên checkout hiện tại không thấy endpoint nộp đề xuất hoặc chỗ gọi submittedForApproval; không xem đây là một bước bắt buộc hay luồng FE hoàn chỉnh.

## 6. Tạo đợt mở
Khóa học → Đợt mở khóa học → Tạo đợt.
Nhập mã đợt duy nhất, khóa PUBLISHED, HLV chính ACTIVE, phòng ACTIVE đủ sức chứa, học phí VND, sức chứa, số tối thiểu <= sức chứa, tổng buổi 1..366, thời gian mở/đóng đăng ký, cam kết HLV đích danh. Chọn ngày khai giảng, thứ học (ví dụ 2–4–6), giờ bắt đầu/kết thúc. BE tự tính ngày kết thúc và danh sách buổi; không nhập ngày kết thúc thủ công.
Thứ tự thời gian: mở đăng ký < đóng đăng ký <= bắt đầu học < kết thúc học. FE nhập theo UTC+7 và gửi ISO.
FE lấy số tối thiểu mặc định từ khóa khi chọn khóa, nhưng đây là số độc lập ở đợt. Sửa số tối thiểu của đợt chỉ được khi DRAFT.
Xem preview rồi bấm Tạo đợt và lịch học: BE lưu DRAFT cùng đủ buổi trong một transaction. Nếu một buổi trùng tài nguyên, rollback toàn bộ. Ngày khai giảng phải thuộc thứ đã chọn; học phí phải đủ phân bổ ít nhất 1 VND mỗi buổi.
Cam kết HLV là dữ liệu riêng; bộ kiểm tra xếp lịch hiện không bắt mọi buổi phải dùng HLV chính.

## 7. Kiểm tra và chỉnh lịch từng buổi
Chi tiết đợt → Lịch buổi học → Thêm buổi.
Nhập số thứ tự (1..tổng buổi), phòng, HLV, bắt đầu, kết thúc, giá trị phân bổ VND (>0).
BE kiểm tra thời gian trong khung đợt, phòng/HLV ACTIVE, sức chứa phòng >= sức chứa đợt; chặn trùng tài nguyên với buổi khóa khác/lớp thường, nghỉ HLV đã duyệt và đình chỉ phòng.
Form lịch tuần đã sinh đủ số buổi với phòng/HLV đã chọn, chia học phí đều và dồn phần dư vào buổi cuối. Thêm buổi thủ công chỉ dành cho dữ liệu cũ thiếu lịch hoặc trường hợp phù hợp; không phải bước bắt buộc sau tạo mới.
Giá trị allocationVnd trên buổi được lưu nhưng thanh toán hiện chia đều số tiền thực trả vào course_enrollment_sessions, cộng phần dư vào buổi cuối. Hoàn tiền dùng phân bổ của enrollment; không mặc định dùng số người quản lý nhập ở buổi.

## 8. Mở đăng ký
Chi tiết đợt DRAFT → Mở đăng ký → nhập phiên bản chính sách (FE mặc định course-mvp-v1) → xác nhận.
BE lưu policyVersionSnapshot, chuyển OPEN_FOR_REGISTRATION và ghi audit. Đây là mã phiên bản; form không nhập đầy đủ văn bản chính sách.
Đăng ký chỉ hợp lệ trong khoảng [registrationOpensAt, registrationClosesAt), khi khóa còn PUBLISHED.
BE kiểm tra khóa còn PUBLISHED và đủ lịch hợp lệ trước khi mở đăng ký. Đợt cũ thiếu buổi phải bổ sung trước; đợt tạo bằng form tuần đã có lịch để kiểm tra.

## 9. Hội viên đăng ký và thanh toán
Hội viên → Khám phá khóa học → chọn đợt; hoặc lễ tân tạo đăng ký hộ.
BE kiểm tra hội viên ACTIVE, đợt và thời gian đăng ký hợp lệ, chưa giữ chỗ/chưa đăng ký trùng, còn chỗ và không xung đột lịch đã kiểm tra.
Số chỗ sử dụng bao gồm enrollment, giữ chỗ thanh toán, lời mời waitlist và giữ chỗ chuyển đợt còn hiệu lực.
Tạo course_order PENDING_PAYMENT và reservation HELD; hết hạn tại min(hiện tại +15 phút, đóng đăng ký). Idempotency key ngăn gửi lại cùng yêu cầu tạo đơn trùng.
Thanh toán thành công qua tiền mặt tại lễ tân hoặc luồng chuyển khoản/đối soát tạo enrollment, lưu số tiền/số buổi tại thời điểm mua, tạo lịch tham gia từng buổi và thông báo hội viên.
Bấm đăng ký chưa phải đã có enrollment. Khi thanh toán, BE yêu cầu đủ số buổi và số buổi chưa bắt đầu phải hơn 70% tổng số buổi.

## 10. Chốt đợt và học
Scheduler đóng đăng ký mặc định mỗi 30 giây. Đến hạn, dọn giữ chỗ hết hạn và đếm enrollment ACTIVE/WITHDRAWAL_PENDING.
Đủ tối thiểu → CONFIRMED, thông báo hội viên, đóng waitlist. Thiếu tối thiểu → CANCELLED, hết hạn đơn/giữ chỗ liên quan và tạo nghĩa vụ hoàn tiền cho người đã thanh toán.
Nghĩa vụ hoàn tiền không có nghĩa tiền đã tự chuyển về ngân hàng.
Scheduler vận hành đưa CONFIRMED → IN_PROGRESS khi tới thời gian bắt đầu; xử lý trạng thái các buổi theo thời gian và xử lý kết thúc/hoàn tiền các buổi không giải quyết được.
Cuối đợt có SETTLEMENT_PENDING → COMPLETED; code hiện có thể thực hiện cả hai bước trong cùng giao dịch, không đồng nghĩa mọi khoản hoàn đã chi trả.

## Ví dụ thao tác
Swimming → khóa SWIM-BASIC → Công khai → tạo đợt, học phí 2.400.000, sức chứa 12, tối thiểu 6, tổng 8 buổi → chọn thứ 2–4–6, khai giảng vào thứ Hai, giờ 18:00–19:00 và phòng → xem lịch/ngày kết thúc tự tính → lưu → mở đăng ký → hội viên xem lịch rồi thanh toán.
Đến hạn, 6 enrollment hợp lệ trở lên thì xác nhận mở; chỉ có 5 thì hủy và phát sinh hoàn tiền.

## Mã nguồn đối chiếu
- FE: src/pages/manager/disciplines/DisciplineCreatePage.jsx; src/pages/manager/courses/ManagerCoursesPage.jsx, ManagerCourseDetailPage.jsx, ManagerCourseRunsPage.jsx, ManagerCourseRunDetailPage.jsx.
- BE: scheduling/DisciplineService.java; course/CourseManagementService.java, Course.java, CourseRun.java, CourseSessionService.java, CourseOrderService.java, CourseRunClosureService.java, CourseSessionDisruptionService.java; membership/PaymentFulfillmentService.java.
