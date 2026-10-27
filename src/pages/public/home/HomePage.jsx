// Public homepage (giao diện tối).
// Sections in order:
//   - Header cố định
//   - Hero
//   - Giá trị cốt lõi
//   - CTA khám phá gói tập
//   - Không gian
//   - Footer
//
// Điều hướng các nút:
//   - Đăng ký trải nghiệm / Đăng ký thành viên -> /register
//   - Đăng nhập / Đăng ký gói                  -> /login
//   - Gói tập (menu)                           -> /offers
//   - Khám phá các gói tập                     -> /offers

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import PublicHeader from '../../../components/layout/PublicHeader';
import PublicFooter from '../../../components/layout/PublicFooter';
import Icon from '../../../components/layout/PublicIcon';
import {
  HOMEPAGE_COPY,
  FEATURES,
  SPACES,
} from '../../../content/homeContent';

import './HomePage.css';

export default function HomePage() {
  const { isAuthenticated, isReady, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="scms-home">
      {/* Header dùng chung */}
      <PublicHeader active="home" />

      {isReady && isAuthenticated && user?.role === 'MANAGER' && (
        <aside className="scms-home-manager-bar" aria-label="Manager Dashboard">
          <div className="scms-home-manager-bar-icon" aria-hidden="true">
            <Icon name="dumbbell" size={26} />
          </div>
          <div className="scms-home-manager-bar-body">
            <span className="scms-home-manager-bar-eyebrow">Khu vực quản lý</span>
            <h2 className="scms-home-manager-bar-title">Manager Dashboard</h2>
            <p className="scms-home-manager-bar-sub">
              Xin chào{user?.fullName ? `, ${user.fullName}` : ''}. Đây là khu vực dành riêng
              cho tài khoản quản lý. Truy cập dashboard để xem nhân viên, hội viên và các
              báo cáo vận hành.
            </p>
          </div>
          <div className="scms-home-manager-bar-actions">
            <Link
              to="/manager/dashboard"
              className="scms-home-btn scms-home-btn-primary"
            >
              Mở Dashboard <Icon name="arrowRight" size={16} />
            </Link>
            <button
              type="button"
              className="scms-home-btn scms-home-btn-ghost"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </div>
        </aside>
      )}

      <main>
        {/* Hero */}
        <section className="scms-home-hero">
          <div className="scms-home-wrap">
            <div className="scms-home-pill">
              <span className="scms-home-dot" />
              {HOMEPAGE_COPY.badge}
            </div>

            <div className="row g-4 align-items-end mb-5">
              <div className="col-lg-8">
                <h1 className="scms-home-h1">
                  {HOMEPAGE_COPY.heroTitleBefore}{' '}
                  <span className="scms-home-accent">{HOMEPAGE_COPY.heroTitleAccent}</span>{' '}
                  {HOMEPAGE_COPY.heroTitleAfter}
                </h1>
              </div>
              <div className="col-lg-4">
                <p className="scms-home-muted mb-0">{HOMEPAGE_COPY.heroDesc}</p>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-3">
              <Link to="/register" className="scms-home-btn scms-home-btn-primary scms-home-btn-lg">
                {HOMEPAGE_COPY.heroPrimary} <Icon name="arrowRight" size={18} />
              </Link>
              <Link
                to="/offers"
                className="scms-home-btn scms-home-btn-ghost scms-home-btn-lg"
              >
                {HOMEPAGE_COPY.heroSecondary} <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/login" className="scms-home-link-muted">
                {HOMEPAGE_COPY.heroLogin}
              </Link>
            </div>
          </div>
        </section>

        {/* Giá trị cốt lõi */}
        <section className="scms-home-section">
          <div className="scms-home-wrap">
            <div className="row g-3 align-items-end mb-5">
              <div className="col-md-7">
                <span className="scms-home-eyebrow">{HOMEPAGE_COPY.featuresEyebrow}</span>
                <h2 className="scms-home-h2">{HOMEPAGE_COPY.featuresTitle}</h2>
              </div>
              <div className="col-md-5">
                <p className="scms-home-muted small mb-0">{HOMEPAGE_COPY.featuresSubtitle}</p>
              </div>
            </div>
            <div className="row g-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="col-md-4">
                  <div className="scms-home-card h-100 d-flex flex-column justify-content-between">
                    <div>
                      <div className="scms-home-icon-box">
                        <Icon name={f.icon} />
                      </div>
                      <h3 className="scms-home-h3">{f.title}</h3>
                      <p className="scms-home-muted mb-0">{f.desc}</p>
                    </div>
                    <div className="scms-home-note">
                      {f.note} <Icon name="check" size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA gói tập */}
        <section className="scms-home-section scms-home-section-dark" id="pricing-section">
          <div className="scms-home-wrap">
            <div className="scms-home-offers-cta">
              <div className="scms-home-offers-cta-copy">
                <span className="scms-home-eyebrow">Gói tập dành cho bạn</span>
                <h2 className="scms-home-h2">Chọn hành trình luyện tập phù hợp</h2>
                <p className="scms-home-muted mb-0">
                  Khám phá các gói Basic, Plus và Premium cùng thời hạn, mức giá và
                  quyền lợi được cập nhật trực tiếp từ hệ thống.
                </p>
              </div>
              <Link
                to="/offers"
                className="scms-home-btn scms-home-btn-primary scms-home-btn-lg"
              >
                Khám phá các gói tập <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* Không gian */}
        <section className="scms-home-section">
          <div className="scms-home-wrap">
            <div className="mb-5">
              <span className="scms-home-eyebrow">{HOMEPAGE_COPY.spaceEyebrow}</span>
              <h2 className="scms-home-h2">{HOMEPAGE_COPY.spaceTitle}</h2>
            </div>
            <div className="row g-4">
              {SPACES.map((s) => (
                <div key={s.title} className={s.wide ? 'col-md-8' : 'col-md-4'}>
                  <div
                    className="scms-home-space"
                    style={{ backgroundImage: `url('${s.image}')` }}
                  >
                    <div className="scms-home-space-text">
                      <span className="scms-home-eyebrow">{s.eyebrow}</span>
                      <h3 className="scms-home-h3 mb-1">{s.title}</h3>
                      <p className="scms-home-muted small mb-0">{s.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer dùng chung */}
      <PublicFooter />
    </div>
  );
}
