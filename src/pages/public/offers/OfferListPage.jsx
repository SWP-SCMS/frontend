// Bảng gói tập công khai (/offers), giao diện tối đồng bộ với trang chủ.
//
// API: GET /api/v1/membership-offers  (công khai, chỉ trả Offer ACTIVE)
//
// Bố cục: mỗi khu vực là một loại gói (Basic, Plus, Premium...), các mức giá
// trong cùng loại gói được sắp theo thời hạn tăng dần.
//
// Nút Chọn gói (xem OfferCtaButton.jsx): chưa đăng nhập -> Đăng nhập; Hội viên
// đã đăng nhập -> trang thanh toán gói (/member/checkout/:offerId).

import { useCallback, useEffect, useMemo, useState } from 'react';
import PublicDarkLayout from '../../../components/layout/PublicDarkLayout';
import Icon from '../../../components/layout/PublicIcon';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import {
  OFFERS_COPY,
  TRUST_POINTS,
  FAQS,
} from '../../../content/offersContent';
import {
  buildFeatures,
  computeOfferPricing,
  findBestSavingsOfferId,
  formatDuration,
  isDisplayableOffer,
} from './offerUtils';
import OfferCtaButton from './OfferCtaButton';
import './OfferListPage.css';

function planRank(label = '') {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'BASIC') return 0;
  if (normalized === 'PLUS') return 1;
  if (normalized === 'PREMIUM') return 2;
  return 3;
}

export default function OfferListPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Bỏ các gói chưa có mô tả hợp lệ (xem isDisplayableOffer).
      setOffers((await listActiveOffers()).filter(isDisplayableOffer));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Giá mỗi tháng / % tiết kiệm tính trên TOÀN BỘ Offer của cùng gói.
  const pricing = useMemo(() => computeOfferPricing(offers), [offers]);
  const bestId = useMemo(() => findBestSavingsOfferId(pricing), [pricing]);

  // Gom theo loại gói giống trang Member; vẫn hỗ trợ plan động từ API.
  const planGroups = useMemo(() => {
    const groups = new Map();
    for (const offer of offers) {
      const key = offer.planCode || offer.planDisplayName || 'OTHER';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: offer.planDisplayName || offer.planCode || 'Gói khác',
          offers: [],
        });
      }
      groups.get(key).offers.push(offer);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        offers: [...group.offers].sort(
          (a, b) =>
            Number(a.durationDays) - Number(b.durationDays) ||
            (a.name || '').localeCompare(b.name || '', 'vi'),
        ),
      }))
      .sort(
        (a, b) =>
          planRank(a.label) - planRank(b.label) ||
          a.label.localeCompare(b.label, 'vi'),
      );
  }, [offers]);

  let body;
  if (loading) {
    body = (
      <div className="sof-categories" aria-busy="true" aria-label="Đang tải gói tập">
        {[0, 1].map((i) => (
          <div className="sof-category" key={i}>
            <div className="sof-category-title sof-heading-skeleton" />
            <div className="sof-category-grid">
            <div className="sof-card sof-skeleton" />
            <div className="sof-card sof-skeleton" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className="sof-state">
        <h3>Không tải được bảng gói tập</h3>
        <p>
          {error?.response
            ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.'
            : 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'}
        </p>
        <button
          type="button"
          className="scms-home-btn scms-home-btn-primary"
          onClick={load}
        >
          <Icon name="refresh" size={16} /> Thử lại
        </button>
      </div>
    );
  } else if (offers.length === 0) {
    body = (
      <div className="sof-state">
        <h3>Hiện chưa có gói tập nào đang mở bán</h3>
        <p>Vui lòng quay lại sau hoặc liên hệ lễ tân để được tư vấn.</p>
      </div>
    );
  } else {
    body = (
      <div className="sof-categories">
        {planGroups.map((group) => (
          <section className="sof-category" key={group.key}>
            <h3 className="sof-category-title">{group.label}</h3>
            <div className="sof-category-grid">
              {group.offers.map((offer) => (
                <OfferCard
                  key={offer.offerId}
                  offer={offer}
                  info={pricing.get(offer.offerId)}
                  best={offer.offerId === bestId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <PublicDarkLayout active="offers">
      {/* Đầu trang */}
      <section className="scms-home-hero sof-hero">
        <div className="scms-home-wrap">
          <span className="scms-home-eyebrow">{OFFERS_COPY.eyebrow}</span>
          <h1 className="scms-home-h1 sof-title">{OFFERS_COPY.title}</h1>
          <p className="scms-home-muted sof-subtitle">{OFFERS_COPY.subtitle}</p>

          <div className="row g-3 mt-4">
            {TRUST_POINTS.map((t) => (
              <div className="col-md-4" key={t.title}>
                <div className="sof-trust">
                  <span className="sof-trust-icon">
                    <Icon name={t.icon} size={20} />
                  </span>
                  <div>
                    <div className="sof-trust-title">{t.title}</div>
                    <div className="scms-home-muted small">{t.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Danh sách gói */}
      <section className="scms-home-section" id="offers-list">
        <div className="scms-home-wrap">
          <h2 className="scms-home-h2 sof-heading">{OFFERS_COPY.listTitle}</h2>
          {body}
        </div>
      </section>

      {/* Câu hỏi thường gặp */}
      <section className="scms-home-section">
        <div className="scms-home-wrap">
          <div className="text-center mx-auto mb-5" style={{ maxWidth: 680 }}>
            <span className="scms-home-eyebrow">{OFFERS_COPY.faqEyebrow}</span>
            <h2 className="scms-home-h2">{OFFERS_COPY.faqTitle}</h2>
          </div>
          <div className="sof-faq mx-auto">
            {FAQS.map((item) => (
              <details className="sof-faq-item" key={item.q}>
                <summary>
                  {item.q}
                  <Icon name="chevronDown" size={18} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

    </PublicDarkLayout>
  );
}

// ----- Một thẻ gói tập -----
function OfferCard({ offer, info, best }) {
  const features = buildFeatures(offer);
  const perMonth = info?.perMonth;
  const showPerMonth = perMonth && Number(offer.durationDays) !== 30;

  return (
    <article className="sof-card">
      {best ? <span className="sof-ribbon">Tiết kiệm nhất</span> : null}

      <div className="sof-card-top">
        <span className="sof-plan">{offer.planDisplayName || offer.planCode}</span>
        <span className="sof-duration">
          <Icon name="clock" size={14} /> {formatDuration(offer.durationDays)}
        </span>
      </div>

      <h3 className="sof-name">{offer.name}</h3>
      {offer.description ? (
        <p className="scms-home-muted small sof-desc">{offer.description}</p>
      ) : null}

      <div className="sof-price">
        <span className="sof-price-value">
          {formatPrice(offer.priceAmount, offer.currencyCode)}
        </span>
        <span className="scms-home-muted small">
          / {formatDuration(offer.durationDays)}
        </span>
      </div>
      <div className="sof-permonth">
        {showPerMonth ? (
          <>
            ≈ {formatPrice(perMonth, offer.currencyCode)} / tháng
            {info.savings > 0 ? (
              <span className="sof-save">Tiết kiệm {info.savings}%</span>
            ) : null}
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>

      <ul className="sof-feat">
        {features.map((f) => (
          <li key={f.code || f.text} className={f.ok ? '' : 'off'}>
            <span className="sof-feat-icon">
              <Icon name={f.ok ? 'check' : 'x'} size={16} />
            </span>
            {f.kind === 'group' ? (
              <details className="sof-feat-group">
                <summary>
                  <span>{f.text}</span>
                  <Icon name="chevronDown" size={15} />
                </summary>
                <ul>
                  {f.children.map((child) => (
                    <li key={child.code}>{child.text}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <span>{f.text}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="sof-actions">
        <OfferCtaButton offerId={offer.offerId} />
      </div>
    </article>
  );
}
