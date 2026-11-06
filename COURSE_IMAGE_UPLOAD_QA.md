# Bổ sung chọn ảnh khóa học — 05/11/2026

## Thay đổi
- FE: CourseImageField dùng chung cho form tạo và chỉnh sửa khóa học. Chọn JPEG/PNG từ máy sẽ tải lên BE, điền URL và xem trước ảnh. Vẫn hỗ trợ nhập URL.
- Chặn file rỗng, sai định dạng hoặc lớn hơn 5 MiB; báo tiếng Việt. Khóa nút lưu/hủy khi đang upload; lỗi upload giữ nguyên ảnh trước đó.
- BE: thêm POST /api/v1/manager/courses/images (multipart field `file`), chỉ quản lý đang hoạt động được tải lên. Trả `imageUrl` tương đối.
- Dùng lại bộ kiểm tra/lưu ảnh hiện có nhưng lưu riêng ở data/course-images; cấu hình scms.course-images.directory. GET /api/v1/course-images/* công khai để ảnh hiển thị trên danh mục. Không thay schema DB hoặc hợp đồng tạo/sửa khóa học.
- Cần giữ thư mục ảnh trên ổ đĩa bền vững khi triển khai; upload xong nhưng hủy form hiện vẫn để lại file chưa được tham chiếu. Chưa có tác vụ dọn file đó.

## Kết quả
- PASS: npm run build, npm run lint; Maven compile.
- PASS: CourseImageControllerTests (1 test, 0 failures/errors): lưu PNG thật, kiểm tra bytes, từ chối tài khoản không hoạt động/không đúng vai trò, nội dung giả ảnh và quá giới hạn.
- PASS Chrome MCP + BE thật: chọn PNG từ máy ở form tạo, thấy preview tải thành công, tạo khóa học; mở chỉnh sửa thấy ảnh đã lưu; chọn ảnh lần nữa, lưu, reload vẫn giữ URL mới.
- PASS Chrome MCP: file text bị từ chối bằng tiếng Việt, không thay URL ảnh đang lưu. Kiểm tra validation UI bằng File/DataTransfer; upload PNG thật dùng upload_file.
- Fixture bản nháp: QA-IMAGE-20261105, ID c4d521e1-7e80-4be2-8a50-477258c7e7fb. Không công khai khóa test.
- Đã restart BE local để nạp endpoint mới. Không push/merge.

## Cách test lại
1. Quản lý → Danh mục khóa học → Tạo khóa học. Điền thông tin, chọn JPEG/PNG ở “Chọn ảnh từ máy”. Chờ ảnh hiện rồi tạo.
2. Mở Chi tiết → Chỉnh sửa. Ảnh vừa tải phải hiện; chọn ảnh khác → Lưu thay đổi → F5 → mở lại chỉnh sửa, ảnh mới vẫn còn.
3. Chọn file không phải ảnh hoặc ảnh >5 MiB: thấy lỗi tiếng Việt; ảnh cũ không bị thay. URL ảnh cũ vẫn có thể lưu.
4. Nhập URL http/https thủ công vẫn sử dụng được như trước.
