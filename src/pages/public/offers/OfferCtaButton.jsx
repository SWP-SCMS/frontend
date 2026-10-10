// Nút "Chọn gói" của một Offer, đổi hành vi theo người xem:
//   - Khách chưa đăng nhập        -> trang Đăng nhập; đăng nhập xong (Hội viên)
//                                    tự vào trang thanh toán đúng gói đã chọn
//   - Hội viên                    -> trang thanh toán gói (/member/checkout/:offerId)
//   - Lễ tân / Quản lý / HLV      -> nút mờ "Chỉ dành cho hội viên"
//
// BR-SEC-04: ẩn / mờ nút chỉ là gợi ý giao diện; quyền mua thật do BE kiểm tra.

import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { ROLES } from '../../../constants';

export default function OfferCtaButton({
  offerId,
  highlight = false,
  block = true,
}) {
  const { isAuthenticated, isReady, user } = useAuth();
  const tone = highlight ? 'scms-home-btn-primary' : 'scms-home-btn-ghost';
  const cls = `scms-home-btn scms-home-btn-lg ${tone}${block ? ' w-100' : ''}`;
  const checkoutPath = `/member/checkout/${offerId}`;

  // Đang xác định đăng nhập: giữ chỗ để nút không nhảy.
  if (!isReady) {
    return (
      <button type="button" className={cls} disabled>
        Chọn gói
      </button>
    );
  }

  if (!isAuthenticated) {
    // LoginPage đọc `state.from.pathname` để quay lại đúng trang sau khi đăng nhập.
    return (
      <Link to="/login" state={{ from: { pathname: checkoutPath } }} className={cls}>
        Chọn gói
      </Link>
    );
  }

  if (user?.role === ROLES.MEMBER) {
    return (
      <Link to={checkoutPath} className={cls}>
        Chọn gói
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      disabled
      title="Chỉ tài khoản hội viên mới mua được gói tập"
    >
      Chỉ dành cho hội viên
    </button>
  );
}
