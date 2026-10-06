// Logo SCMS dùng chung cho trang chủ và trang đăng nhập.
// Muốn đổi logo thì chỉ sửa file này (và khối .scms-brandlogo trong BrandLogo.css).

import { Link } from 'react-router-dom';

import './BrandLogo.css';

export default function BrandLogo({ className = '' }) {
  return (
    <Link to="/" className={`scms-brandlogo ${className}`.trim()}>
      <span className="scms-brandlogo-icon" aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6.5 6.5l11 11" />
          <path d="m3 10 7-7" />
          <path d="m14 21 7-7" />
          <path d="m2 6 4-4" />
          <path d="m18 22 4-4" />
        </svg>
      </span>
      <span>
        <span className="scms-brandlogo-name">SCMS</span>
        <span className="scms-brandlogo-sub">Sports Center</span>
      </span>
    </Link>
  );
}
