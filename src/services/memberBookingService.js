// Member Booking API (đặt / hủy / xem lịch đã đặt của chính Hội viên).
//
// Backend lấy Member từ JWT nên FE không truyền Member ID (BR-SEC-04).
//
//   POST  /api/v1/members/class-sessions/{sessionId}/bookings   đặt lịch (201)
//   PATCH /api/v1/members/me/bookings/{bookingId}/cancel        hủy lịch (200)
//   GET   /api/v1/members/me/bookings?status=BOOKED             lịch đã đặt
//
// Lưu ý tên trường: POST/PATCH trả `id` + `sessionId`; GET danh sách trả
// `bookingId` + `sessionId`. Hàm toBookingId() gom về một tên.

import api from './api';

export function toBookingId(booking) {
  return booking?.bookingId ?? booking?.id ?? null;
}

// BR-BKG-03/04: BE kiểm tra Member ACTIVE, Membership PLUS còn hiệu lực,
// buổi tập còn chỗ, không trùng giờ. FE chỉ hiển thị lỗi BE trả về.
export async function bookClassSession(sessionId) {
  const { data } = await api.post(
    `/members/class-sessions/${sessionId}/bookings`,
  );
  return data;
}

// BR-BKG-06: chỉ hủy được khi còn ít nhất 2 giờ trước giờ bắt đầu.
export async function cancelMyBooking(bookingId) {
  const { data } = await api.patch(`/members/me/bookings/${bookingId}/cancel`);
  return data;
}

// Lấy TẤT CẢ lịch đang BOOKED của Member (BE giới hạn size tối đa 100/trang,
// nên lặp qua các trang cho đến khi hết).
export async function listAllMyBookedBookings() {
  const all = [];
  let page = 0;
  for (;;) {
    const { data } = await api.get('/members/me/bookings', {
      params: { status: 'BOOKED', page, size: 100 },
    });
    const content = Array.isArray(data?.content) ? data.content : [];
    all.push(...content);
    const totalPages = typeof data?.totalPages === 'number' ? data.totalPages : 0;
    if (content.length === 0 || page + 1 >= totalPages) break;
    page += 1;
  }
  return all;
}
