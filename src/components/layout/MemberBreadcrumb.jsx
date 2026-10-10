// Breadcrumb dùng chung cho các trang trong Member area:
//   Trang chủ › Hội viên › <tên trang hiện tại>
//
// "Trang chủ" và "Hội viên" chỉ là chữ (không bấm được); tên trang hiện tại
// hiện màu đỏ. Mỗi trang chỉ truyền `current`, không tự viết lại breadcrumb.

import './MemberBreadcrumb.css';

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...iconProps}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function MemberBreadcrumb({ current }) {
  return (
    <nav className="scms-bc" aria-label="Breadcrumb">
      <span>Trang chủ</span>
      <Chevron />
      <span>Hội viên</span>
      <Chevron />
      <strong aria-current="page">{current}</strong>
    </nav>
  );
}
