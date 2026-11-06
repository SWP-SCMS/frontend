# Dời lịch Course Run — kết quả kiểm thử và đề xuất BE

Kiểm thử ngày 02/11/2026, BE main 7e8f551 sau restart, localhost:8080/api/v1; phiên Manager qua Chrome DevTools MCP. Không sửa source BE. Các request chạy tuần tự bằng Axios của FE trong trình duyệt, không thêm workaround vào code FE.

## Kết quả: thành công trên Run kiểm thử

QA-CHROME-RUN-02 có 1 buổi. Lịch ban đầu: 06/11/2026 16:00–17:00 (UTC+07). Lịch mới: 07/11/2026 16:00–17:00.

| Bước | Thao tác | Kết quả |
|---|---|---|
| 1 | Nới Run: giữ bắt đầu 06/11 16:00, kết thúc 07/11 17:00 | HTTP 200; Run version 1 → 2 |
| 2 | Dời session sang 07/11 16:00–17:00, giữ phòng/HLV | HTTP 200; session version 0 → 1 |
| 3 | Thu Run: bắt đầu 07/11 16:00, kết thúc 07/11 17:00 | HTTP 200; Run version 2 → 3 |

GET lại Run và sessions xác nhận lịch mới đã lưu, số buổi/học phí không đổi. Giữ lịch mới trên dữ liệu QA vì phép thử thành công; không rollback. Chưa kiểm tra đầy đủ trải nghiệm thông báo/quyền rút của member, cạnh tranh hoặc lỗi giữa các bước.

## Request tái hiện bằng contract hiện có

### Kiểm tra lại thao tác của user

Sau phép thử thành công, user đổi thẳng khung Run từ 07/11 sang 08/11 qua form (expectedVersion=3). Network request 423 trả 400 COURSE_VALIDATION_ERROR: buổi học giữ lại phải nằm trong khung Run mới. Gửi lại cùng lịch với version đọc mới nhất vẫn trả đúng lỗi đó; GET xác nhận lịch/version không đổi. Nguyên nhân: session vẫn ở 07/11. Không phải lỗi version hoặc server chưa restart.

Nút “Sửa lịch / số buổi đợt học” hiện chỉ PATCH khung Run; chưa triển khai tự dời session. Kết quả thành công phía trên là phép thử chủ động ba request riêng, không phải xác nhận thao tác đổi cả khóa bằng một lần bấm đã được sửa.

### Payload ba bước

Lấy runId/sessionId và version hiện tại từ API; không dùng UUID mẫu hoặc version trong ví dụ cho dữ liệu khác.

1. `PATCH /manager/course-runs/{runId}/schedule`

```json
{"expectedVersion":1,"plannedStartAt":"2026-11-06T16:00:00+07:00","plannedEndAt":"2026-11-07T17:00:00+07:00","totalUnits":1}
```

2. `PATCH /manager/course-runs/{runId}/sessions/{sessionId}`

```json
{"expectedVersion":0,"startAt":"2026-11-07T16:00:00+07:00","endAt":"2026-11-07T17:00:00+07:00"}
```

Trong phép thử thực tế, payload bước 2 còn gửi roomId/coachId lấy nguyên từ session hiện tại. Các field này là tùy chọn theo contract; service giữ assignment hiện tại nếu không gửi. Không chọn tài nguyên khác.

3. `PATCH /manager/course-runs/{runId}/schedule`, dùng version mới nhất đọc lại sau bước 2:

```json
{"expectedVersion":2,"plannedStartAt":"2026-11-07T16:00:00+07:00","plannedEndAt":"2026-11-07T17:00:00+07:00","totalUnits":1}
```

Khung tạm cần chứa cả lịch cũ và mới. Ví dụ này chỉ xác nhận dời muộn 1 ngày với 1 session; không suy rộng thành đã hỗ trợ mọi trường hợp dời sớm, nhiều buổi, buổi đã học hoặc gần giờ học.

## BE cần xử lý để đưa thành chức năng chính thức

- Hai thứ tự trực tiếp đã thử đều bị chặn: đổi Run trước trả 400 COURSE_VALIDATION_ERROR vì buổi cũ ngoài khung mới; đổi session trước trả 409 COURSE_SESSION_INVALID vì ngoài khung Run cũ.
- Ba bước trên chứng minh có thể đi đến lịch cuối hợp lệ. Không nên yêu cầu FE tự gọi hàng loạt request theo số buổi: mỗi request commit riêng, lỗi giữa chừng để lại lịch tạm; rollback lịch bằng request khác cũng không xóa audit/thông báo đã phát sinh.
- Đề xuất contract nhận khung Run cuối cùng cùng danh sách lịch cuối của các session và version tương ứng, xử lý trong một giao dịch. Tên endpoint/payload chính thức do BE cung cấp; không tự giả định contract ở FE.
- Validate trạng thái, quyền Manager, version, số buổi, phòng/HLV, nghỉ phép/đình chỉ phòng, xung đột và quan hệ buổi bù theo trạng thái cuối dự kiến; khóa tài nguyên theo quy ước hiện có. Một lỗi phải rollback toàn bộ thay đổi trong DB.
- Tính ảnh hưởng và quyền rút từ lịch gốc đến lịch cuối. Không công bố khung tạm cho member. Code hiện tạo event/response/notification mỗi lần PATCH Run và mỗi lần dời session, đồng thời supersede response cũ: cần tránh thông báo trung gian hoặc mất ngữ cảnh lịch gốc khi gom thành một thao tác.
- Cần test nhiều buổi, dời >7 ngày, trùng lịch member, phòng/HLV bị chiếm, stale version, lỗi giữa chừng, retry và thông báo sau commit. Phép thử 1 buổi thành công không chứng minh các trường hợp đó đã đúng.

## Hoàn tác khi thao tác nhiều bước thất bại

Phép thử này không thất bại nên không chạy hoàn tác. Nếu dùng quy trình thủ công để chẩn đoán lần khác: đọc lại trạng thái/version; nới khung để chứa cả lịch hiện tại và gốc, đưa các buổi đã đổi về lịch gốc, rồi trả khung Run về gốc. Nếu đã có thay đổi đồng thời hoặc không còn đủ tài nguyên, dừng và báo trạng thái thực tế, không ghi đè cưỡng ép. Đây là khôi phục lịch, không phải rollback giao dịch/audit/thông báo; giải pháp chính thức vẫn cần giao dịch BE nguyên tử.
