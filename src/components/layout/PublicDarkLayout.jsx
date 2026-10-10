// Khung giao diện tối cho các trang công khai (không phải trang chủ): header
// cố định, nội dung, footer. Class `scms-home` cung cấp màu nền và biến màu
// (xem HomePage.css). Trang chủ tự ghép header/footer vì có thêm khối riêng.

import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

export default function PublicDarkLayout({ active, children }) {
  return (
    <div className="scms-home">
      <PublicHeader active={active} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
