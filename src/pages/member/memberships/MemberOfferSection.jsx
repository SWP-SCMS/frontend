// Danh sách gói tập đang mở bán, hiện ngay trên trang "Gói tập" của Hội viên
// (/member/plan) để không phải sang trang công khai /offers.
//
// API: GET /membership-offers (công khai, chỉ trả Offer ACTIVE).
// Nút "Đăng ký" đi tới /member/checkout/:offerId (tạo đơn + thanh toán).
//
// BR-MEM-08: Member đang có Membership ACTIVE thì chưa mua được gói mới. Khi
// đó nút bị khóa kèm lời giải thích (`blockedReason`); BE vẫn kiểm tra lại.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import { MEMBERSHIP_PLAN } from '../../../constants';
import {
  buildFeatures,
  computeOfferPricing,
  findBestSavingsOfferId,
  formatDuration,
  isDisplayableOffer,
} from '../../public/offers/offerUtils';
import './MemberOfferSection.css';

export default function MemberOfferSection({ blockedReason = null }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

  const pricing = useMemo(() => computeOfferPricing(offers), [offers]);
  const bestId = useMemo(() => findBestSavingsOfferId(pricing), [pricing]);

  // Sắp xếp: thời hạn ngắn trước; cùng thời hạn thì BASIC trước PLUS.
  const sorted = useMemo(() => {
    const rank = (code) => (code === MEMBERSHIP_PLAN.BASIC ? 0 : 1);
    return [...offers].sort(
      (a, b) =>
        Number(a.durationDays) - Number(b.durationDays) ||
        rank(a.planCode) - rank(b.planCode),
    );
  }, [offers]);

  return (
    <section id="member-offers" className="scms-mo">
      <h2 className="scms-mo-title">Đăng ký gói tập</h2>
      <p className="scms-mo-sub">
        Chọn gói phù hợp, bấm &quot;Đăng ký&quot; để tạo đơn và thanh toán.
      </p>

      {blockedReason ? (
        <div className="scms-mo-note">{blockedReason}</div>
      ) : null}

      <ErrorAlert error={error} title="Không tải được danh sách gói tập" />

      {loading ? (
        <div className="scms-mo-center">
          <Spinner animation="border" size="sm" /> Đang tải gói tập…
        </div>
      ) : sorted.length === 0 && !error ? (
        <div className="scms-mo-empty">
          Hiện chưa có gói tập nào đang mở bán. Vui lòng liên hệ lễ tân để được
          tư vấn.
        </div>
      ) : (
        <div className="scms-mo-grid">
          {sorted.map((offer) => {
            const isPlus = offer.planCode === MEMBERSHIP_PLAN.PLUS;
            const info = pricing.get(offer.offerId);
            const showPerMonth =
              info?.perMonth && Number(offer.durationDays) !== 30;
            return (
              <article
                key={offer.offerId}
                className={`scms-mo-card${isPlus ? ' plus' : ''}`}
              >
                {offer.offerId === bestId ? (
                  <span className="scms-mo-ribbon">Tiết kiệm nhất</span>
                ) : null}
                <div className="scms-mo-top">
                  <span className="scms-mo-plan">
                    {offer.planDisplayName || offer.planCode}
                  </span>
                  <span className="scms-mo-duration">
                    {formatDuration(offer.durationDays)}
                  </span>
                </div>
                <h3 className="scms-mo-name">{offer.name}</h3>
                {offer.description ? (
                  <p className="scms-mo-desc">{offer.description}</p>
                ) : null}
                <div className="scms-mo-price">
                  {formatPrice(offer.priceAmount, offer.currencyCode)}
                  <small> / {formatDuration(offer.durationDays)}</small>
                </div>
                {showPerMonth ? (
                  <div className="scms-mo-permonth">
                    ≈ {formatPrice(info.perMonth, offer.currencyCode)} / tháng
                    {info.savings > 0 ? ` · Tiết kiệm ${info.savings}%` : ''}
                  </div>
                ) : null}
                <ul className="scms-mo-feat">
                  {buildFeatures(offer).map((f) => (
                    <li key={f.text} className={f.ok ? '' : 'off'}>
                      {f.ok ? '✓' : '–'} {f.text}
                    </li>
                  ))}
                </ul>
                {blockedReason ? (
                  <button type="button" className="scms-mo-btn" disabled>
                    Đăng ký
                  </button>
                ) : (
                  <Link
                    to={`/member/checkout/${offer.offerId}`}
                    className={`scms-mo-btn${isPlus ? ' primary' : ''}`}
                  >
                    Đăng ký
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
