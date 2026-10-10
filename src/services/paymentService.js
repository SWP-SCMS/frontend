// Thanh toán chuyển khoản của Hội viên (SePay).
//
// Luồng: tạo Order (memberService.createMyMembershipOrder) -> tạo yêu cầu
// thanh toán (hàm dưới) -> hiện mã QR + thông tin chuyển khoản -> hỏi kết quả
// định kỳ cho đến khi PAID.
//
// BR-PAY-03: BE tạo mã QR đúng số tiền và nội dung chuyển khoản của Order.
// BR-PAY-04: quét QR KHÔNG phải là xác nhận thanh toán; chỉ khi BE nhận xác nhận
//            từ SePay thì Payment mới sang PAID.
// BR-PAY-10: hạn thanh toán 24 giờ kể từ lúc tạo yêu cầu.

import api from './api';

// POST /api/v1/members/me/membership-orders/{orderId}/payments/sepay
// BE tự "tạo hoặc dùng lại": Order đã có Payment PENDING thì trả lại chính
// Payment đó (an toàn khi bấm lại hoặc tải lại trang), không tạo trùng.
// Trả về: { paymentId, orderId, orderNumber, amount, currency, provider,
//   paymentReference, transferContent, bankCode, bankAccountNumber,
//   bankAccountName, qrUrl, expiresAt, status }
export async function createSepayPayment(orderId) {
  const { data } = await api.post(
    `/members/me/membership-orders/${orderId}/payments/sepay`,
  );
  return data;
}

// GET /api/v1/payments/{paymentId}/result
// Trả về: { paymentId, orderId, status (PENDING | PAID | FAILED), method,
//   membershipId, receiptId, paidAt }
export async function getPaymentResult(paymentId) {
  const { data } = await api.get(`/payments/${paymentId}/result`);
  return data;
}
