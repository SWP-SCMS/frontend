// Public homepage (giao diện tối).
// Sections in order:
//   - Header cố định
//   - Hero
//   - Giá trị cốt lõi
//   - Bảng gói BASIC / PLUS (giá lấy từ API, có giá mặc định dự phòng)
//   - Không gian
//   - Footer
//
// Điều hướng các nút:
//   - Đăng ký trải nghiệm / Đăng ký thành viên -> /register
//   - Đăng nhập / Đăng ký gói                  -> /login
//   - Gói tập (menu)                           -> /offers
//   - Khám phá các gói tập                     -> cuộn xuống bảng giá

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import BrandLogo from '../../../components/common/BrandLogo';
import {
  HOMEPAGE_COPY,
  FEATURES,
  PLAN_OVERVIEW,
  SPACES,
  FOOTER_INFO,
} from '../../../content/homeContent';

import './HomePage.css';

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ name, size = 22 }) {
  const paths = {
    dumbbell: (
      <>
        <path d="M6.5 6.5l11 11" />
        <path d="m3 10 7-7" />
        <path d="m14 21 7-7" />
        <path d="m2 6 4-4" />
        <path d="m18 22 4-4" />
      </>
    ),
    coach: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </>
    ),
    unlock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 9.5-2" />
      </>
    ),
    check: <path d="m5 12 5 5L20 7" />,
    arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
    arrowDown: <path d="M12 5v14m-6-6 6 6 6-6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...iconProps}>
      {paths[name]}
    </svg>
  );
}

// Giá hiển thị: lấy Offer rẻ nhất của gói; không có thì dùng giá mặc định.
function buildPriceInfo(offers, plan) {
  const ofPlan = offers.filter((o) => o.planCode === plan.code);
  if (ofPlan.length === 0) {
    return { price: formatPrice(plan.defaultPrice), unit: '/ tháng', offerId: null };
  }
  const cheapest = ofPlan.reduce((a, b) =>
    Number(b.priceAmount) < Number(a.priceAmount) ? b : a,
  );
  const unit =
    cheapest.durationDays === 30 || !cheapest.durationDays
      ? '/ tháng'
      : `/ ${cheapest.durationDays} ngày`;
  return {
    price: formatPrice(cheapest.priceAmount, cheapest.currencyCode),
    unit,
    offerId: cheapest.offerId,
  };
}

export default function HomePage() {
  const { isAuthenticated, isReady, user, logout } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);

  // Role-aware "Trang cá nhân" target. Member has its own dashboard at
  // /member/dashboard; other roles stay on their role-scoped home.
  const personalHomePath = useMemo(() => {
    switch (user?.role) {
      case 'MEMBER':
        return '/member/dashboard';
      case 'MANAGER':
        return '/manager/dashboard';
      case 'RECEPTIONIST':
        return '/reception';
      case 'COACH':
        return '/coach';
      default:
        return '/login';
    }
  }, [user?.role]);

  // Không tải được Offer thì vẫn hiện giá mặc định, không báo lỗi cho khách.
  useEffect(() => {
    let cancelled = false;
    listActiveOffers()
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  function scrollToPricing(e) {
    e.preventDefault();
    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="scms-home">
      {/* Header */}
      <header className="scms-home-header">
        <BrandLogo />

        <nav className="scms-home-nav d-none d-md-flex">
          <Link to="/" className="active">Trang chủ</Link>
          <Link to="/offers">Gói tập</Link>
        </nav>

        <div className="scms-home-actions">
          {isReady && isAuthenticated ? (
            <>
              <span className="d-none d-md-inline small text-secondary">
                {user?.fullName || 'Tài khoản'}
              </span>
              <Link
                to={personalHomePath}
                className="scms-home-btn scms-home-btn-ghost"
              >
                Trang cá nhân
              </Link>
              <button
                type="button"
                className="scms-home-btn scms-home-btn-primary"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="scms-home-btn scms-home-btn-ghost d-none d-sm-inline-flex">
                Đăng nhập
              </Link>
              <Link to="/register" className="scms-home-btn scms-home-btn-primary">
                Đăng ký thành viên
              </Link>
            </>
          )}
        </div>
      </header>

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
              <a
                href="#pricing-section"
                onClick={scrollToPricing}
                className="scms-home-btn scms-home-btn-ghost scms-home-btn-lg"
              >
                {HOMEPAGE_COPY.heroSecondary} <Icon name="arrowDown" size={18} />
              </a>
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

        {/* Bảng giá */}
        <section className="scms-home-section scms-home-section-dark" id="pricing-section">
          <div className="scms-home-wrap">
            <div className="text-center mx-auto mb-5" style={{ maxWidth: 680 }}>
              <span className="scms-home-eyebrow">{HOMEPAGE_COPY.planEyebrow}</span>
              <h2 className="scms-home-h2">{HOMEPAGE_COPY.planTitle}</h2>
              <p className="scms-home-muted mb-0">{HOMEPAGE_COPY.planSubtitle}</p>
            </div>

            <div className="row g-4 mx-auto" style={{ maxWidth: 900 }}>
              {PLAN_OVERVIEW.map((plan) => {
                const info = buildPriceInfo(offers, plan);
                return (
                  <div key={plan.code} className="col-lg-6">
                    <div
                      className={`scms-home-plan h-100 ${plan.highlight ? 'scms-home-plan-hl' : ''
                        }`}
                    >
                      {plan.badge ? (
                        <span className="scms-home-plan-badge">{plan.badge}</span>
                      ) : null}
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                          <span className="fw-semibold text-uppercase">{plan.title}</span>
                          <span className="scms-home-tag">{plan.tag}</span>
                        </div>
                        <p className="scms-home-muted small mb-4">{plan.tagline}</p>
                        <div className="mb-4">
                          <span
                            className={`scms-home-price ${plan.highlight ? 'scms-home-accent-soft' : ''}`}
                          >
                            {info.price}
                          </span>{' '}
                          <span className="scms-home-muted small">{info.unit}</span>
                        </div>
                        <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
                          {plan.bullets.map((b) => (
                            <li key={b} className="d-flex gap-2 small">
                              <span className="scms-home-check">
                                <Icon name="check" size={18} />
                              </span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Link
                        to="/login"
                        className={`scms-home-btn scms-home-btn-lg w-100 mt-4 ${plan.highlight ? 'scms-home-btn-primary' : 'scms-home-btn-ghost'
                          }`}
                      >
                        {plan.cta}
                      </Link>
                    </div>
                  </div>
                );
              })}
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

      {/* Footer */}
      <footer className="scms-home-footer">
        <div className="scms-home-wrap">
          <div className="row g-4">
            <div className="col-md-6">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="scms-home-logo scms-home-logo-sm" aria-hidden="true">
                  <Icon name="dumbbell" size={16} />
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
              <p className="scms-home-accent-soft fw-semibold mb-0">{FOOTER_INFO.hours}</p>
            </div>
          </div>
          <div className="d-flex flex-wrap justify-content-between gap-2 mt-5 pt-3 scms-home-muted small">
            <span>© {new Date().getFullYear()} SCMS Sports Center. All rights reserved.</span>
            <span>{FOOTER_INFO.standard}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
