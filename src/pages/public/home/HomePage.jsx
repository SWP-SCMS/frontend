// Public homepage (giao diện tối).
// Sections in order:
//   - Header cố định
//   - Hero
//   - Giá trị cốt lõi
//   - Bảng gói động lấy từ API
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
import {
  getMembershipBenefitState,
  groupMembershipBenefits,
} from '../../../utils/membershipBenefits';
import PublicHeader from '../../../components/layout/PublicHeader';
import PublicFooter from '../../../components/layout/PublicFooter';
import Icon from '../../../components/layout/PublicIcon';
import {
  HOMEPAGE_COPY,
  FEATURES,
  SPACES,
} from '../../../content/homeContent';

import './HomePage.css';

// Giá hiển thị: lấy Offer rẻ nhất của loại gói.
function buildPriceInfo(offers, plan) {
  const ofPlan = offers.filter((o) => o.planCode === plan.code);
  if (ofPlan.length === 0) return null;
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

function buildDynamicPlanOverview(offers) {
  const grouped = new Map();
  offers.forEach((offer) => {
    if (!grouped.has(offer.planCode)) grouped.set(offer.planCode, []);
    grouped.get(offer.planCode).push(offer);
  });
  return [...grouped.entries()].map(([code, items]) => {
    const sample = items[0];
    const benefitState = getMembershipBenefitState(sample);
    const bullets = benefitState.known
      ? groupMembershipBenefits(sample)
          .filter((item) => item.status !== 'INACTIVE')
          .map((item) => ({
            key: item.key,
            text: item.displayName,
            children:
              item.kind === 'group'
                ? item.benefits.map((benefit) => ({
                    code: benefit.code,
                    text: benefit.displayName,
                  }))
                : [],
          }))
      : [];
    if (!benefitState.known && sample.supportsBooking) {
      bullets.push({
        key: 'CLASS_BOOKING',
        text: 'Đặt lịch lớp trực tuyến',
        children: [],
      });
    }
    if (!benefitState.known && sample.supportsPersonalCoaching) {
      bullets.push({
        key: 'PERSONAL_COACHING',
        text: 'Huấn luyện viên cá nhân',
        children: [],
      });
    }
    if (bullets.length === 0) {
      bullets.push({
        key: 'PLAN_BENEFITS',
        text: 'Quyền lợi áp dụng theo loại gói đã chọn',
        children: [],
      });
    }
    return {
      code,
      title: sample.planDisplayName || code,
      tag: `${items.length} mức giá`,
      tagline: sample.description || 'Lựa chọn thời hạn phù hợp với mục tiêu tập luyện.',
      bullets,
      cta: 'Xem và đăng ký',
      defaultPrice: 0,
    };
  });
}

export default function HomePage() {
  const { isAuthenticated, isReady, user, logout } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const planOverview = useMemo(
    () => buildDynamicPlanOverview(offers),
    [offers],
  );

  useEffect(() => {
    let cancelled = false;
    listActiveOffers()
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
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
              {!offersLoading && planOverview.length === 0 ? (
                <div className="col-12 text-center scms-home-muted">
                  Hiện chưa tải được danh sách gói tập.{' '}
                  <Link to="/offers" className="scms-home-accent-soft">
                    Mở trang gói tập
                  </Link>
                </div>
              ) : null}
              {planOverview.map((plan) => {
                const info = buildPriceInfo(offers, plan);
                if (!info) return null;
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
                          {plan.bullets.map((benefit) => (
                            <li key={benefit.key} className="d-flex gap-2 small">
                              <span className="scms-home-check">
                                <Icon name="check" size={18} />
                              </span>
                              {benefit.children.length > 0 ? (
                                <details className="scms-home-benefit-group">
                                  <summary>
                                    <span>{benefit.text}</span>
                                    <Icon name="chevronDown" size={15} />
                                  </summary>
                                  <ul>
                                    {benefit.children.map((child) => (
                                      <li key={child.code}>{child.text}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : (
                                <span>{benefit.text}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Link
                        to={info.offerId ? `/offers/${info.offerId}` : '/offers'}
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

      {/* Footer dùng chung */}
      <PublicFooter />
    </div>
  );
}
