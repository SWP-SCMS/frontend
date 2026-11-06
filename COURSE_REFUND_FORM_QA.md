# Kiểm thử hoàn tiền bằng form Chrome MCP — 05/11/2026

## Phạm vi và dữ liệu

- FE localhost:5175, BE thật localhost:8080; phiên Quản lý và Lễ tân riêng.
- Đợt `QA-FORM-REFUND-20261105`, ID `68e244ad-d353-49f2-9c61-6c6df80aa9ff`.
- Hội viên QA `MB-100068`; đơn `18ac0aed-4abf-4ae2-b830-801350546ce2`.
- Đợt đã tạo bằng form lịch thứ 2–4–6, 10 buổi, 07–28/03/2033, 18:00–19:00, học phí 1.000.000đ. Tiếp tục từ trạng thái đã mở đăng ký.
- Lượt tiếp tục này dùng click/fill/fill_form/snapshot của Chrome DevTools MCP, không gọi API thay submit, không sửa DB hoặc mô phỏng trạng thái đã học. Tất cả thu/chi là dữ liệu QA, không có tiền thật.

## Các bước thực hiện và kết quả

1. Lễ tân → Khóa học → Đăng ký khóa học; tra mã MB-100068, chọn đúng mã đợt, bấm Tạo đơn đăng ký: PASS, đơn chờ 1.000.000đ.
2. Bấm Xác nhận đã nhận đủ tiền mặt → Xác nhận thu tiền: PASS, giao diện hiện Đã thanh toán và thông báo thành công.
3. Quản lý → Chi tiết đợt → Sửa lịch / số buổi; đổi Số buổi giữ lại từ 10 thành 8, bấm Xác nhận áp dụng toàn bộ lịch: PASS. Buổi 9–10 hiển thị Đã bỏ do giảm số buổi, nút chỉnh sửa khóa; phân bổ vẫn 100.000đ/buổi. Có một nghĩa vụ hoàn giảm buổi 200.000đ.
4. Bấm Hủy đợt mở; xem tác động 1 đăng ký/0 đơn chờ; nhập lý do QA rồi xác nhận: PASS. Khoản Hủy đợt học là 800.000đ, không cộng trùng 200.000đ trước đó.
5. Quản lý → Hoàn tiền khóa học → Xem hồ sơ khoản 200.000đ → Duyệt, nhập lý do, xác nhận: PASS về nghiệp vụ nhưng phát hiện danh sách kẹt Đang tải; đã sửa như phần dưới.
6. Lễ tân → Hoàn tiền khóa học → Tải lại → Chi tiết đúng khoản 200.000đ: Đủ điều kiện chi, đợt Đã hủy. Nhập mã `QA-FORM-CASH-200K`, chứng từ `QA simulated receipt FORM-20261105-200K; no real money`, tích xác nhận và Ghi nhận đã chi: PASS.
7. Quản lý duyệt khoản 800.000đ qua form; Lễ tân ghi nhận chi tương tự với mã `QA-FORM-CASH-800K` và chứng từ `QA simulated receipt FORM-20261105-800K; no real money`: PASS. Sau sửa, danh sách tự cập nhật khi đóng hồ sơ, không cần reload.
8. Quản lý mở từng hồ sơ → Xác minh hoàn tất; nhập lại đúng số tiền 200000/800000, mã tham chiếu và chứng từ tương ứng, lý do QA; bấm Xác nhận xác minh hoàn tất: PASS.
9. Snapshot cuối danh sách hiển thị cả hai dòng đúng mã đợt, 200.000đ và 800.000đ, cùng trạng thái Đã xác minh hoàn tất. Console Quản lý cuối lượt không có error/warn.

Nghĩa vụ giảm buổi: `17745052-b9b3-4838-9829-f723eef37269`. Nghĩa vụ hủy đợt: `6b540709-d367-4f4e-870f-86605f689143`.

## Bug phát hiện và sửa

- File: `src/pages/manager/courses/ManagerCourseWorkflowPage.jsx`.
- Triệu chứng: sau duyệt thành công rồi đóng hồ sơ, danh sách kẹt Đang tải, nút Tải lại bị khóa dù khoản đã duyệt xuất hiện tại Lễ tân.
- Nguyên nhân: tăng revision khi mutation còn busy khởi động lượt tải; khi busy kết thúc, generation của polling thay đổi và kết quả lượt đó bị loại. Effect danh sách không phụ thuộc busy nên không khởi động lại lượt foreground để kết thúc loading.
- Sửa: thêm busy vào dependency của effect danh sách, bảo đảm tải lại theo trạng thái mutation mới nhất. Không thay đổi hợp đồng API hoặc code BE.
- Retest: duyệt khoản 800.000đ và xác minh cả hai khoản, đóng modal ngay sau submit; danh sách trở lại đầy đủ, trạng thái cập nhật đúng, không cần refresh trình duyệt.
- `npm run lint`: PASS. `npm test`: PASS 40/40. `npm run build`: PASS; còn cảnh báo dynamic/static import authService có sẵn.

## Giới hạn cần phân biệt

- Ca form này chưa học buổi nào: tổng hoàn đúng là 200.000 + 800.000 = 1.000.000đ.
- Ca yêu cầu ban đầu đã học 1 buổi: kỳ vọng 200.000 + 700.000 = 900.000đ. Lượt trước xác nhận bằng API/fixture có mô phỏng COMPLETED và IN_PROGRESS; xem backend/docs/COURSE_ORIGINAL_UNIT_REFUNDS.md. Không gọi ca đó là test toàn bộ bằng form hoặc test scheduler thời gian thực.
- Chưa chạy lại mọi nhánh giảm nhiều lần, học bù, cạnh tranh, hoặc giao dịch ngân hàng thật trong lượt này.
- Không push/merge. Giữ dữ liệu QA ở trạng thái hủy và các khoản hoàn đã xác minh để người dùng kiểm tra.
