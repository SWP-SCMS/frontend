// Footer (giao diện tối) của các trang công khai. Tách ra từ HomePage.jsx để
// dùng chung. Nội dung chữ lấy từ content/homeContent.js (FOOTER_INFO).

import { FOOTER_INFO } from '../../content/homeContent';
import PublicIcon from './PublicIcon';

export default function PublicFooter() {
  return (
    <footer className="scms-home-footer">
      <div className="scms-home-wrap">
        <div className="row g-4">
          <div className="col-md-6">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="scms-home-logo scms-home-logo-sm" aria-hidden="true">
                <PublicIcon name="dumbbell" size={16} />
              </span>
              <span className="fw-semibold text-uppercase">SCMS Gym</span>
            </div>
            <p className="scms-home-muted small">{FOOTER_INFO.desc}</p>
            <span className="scms-home-muted small">{FOOTER_INFO.project}</span>
          </div>
          <div className="col-md-3">
            <div className="fw-semibold mb-2">Địa chỉ &amp; Liên hệ</div>
            <p className="scms-home-muted small mb-1">{FOOTER_INFO.address}</p>
            <p className="scms-home-muted small mb-1">{FOOTER_INFO.hotline}</p>
            <p className="scms-home-muted small mb-0">{FOOTER_INFO.email}</p>
          </div>
          <div className="col-md-3">
            <div className="fw-semibold mb-2">Giờ mở cửa</div>
            <p className="scms-home-muted small mb-1">{FOOTER_INFO.hoursDays}</p>
            <p className="scms-home-accent-soft fw-semibold mb-0">
              {FOOTER_INFO.hours}
            </p>
          </div>
        </div>
        <div className="d-flex flex-wrap justify-content-between gap-2 mt-5 pt-3 scms-home-muted small">
          <span>
            © {new Date().getFullYear()} SCMS Sports Center. All rights reserved.
          </span>
          <span>{FOOTER_INFO.standard}</span>
        </div>
      </div>
    </footer>
  );
}
