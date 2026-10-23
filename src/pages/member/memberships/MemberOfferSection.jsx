// Danh sách gói tập đang mở bán, hiện ngay trên trang "Gói tập" của Hội viên
// (/member/plan) để không phải sang trang công khai /offers.
//
// API: GET /membership-offers (công khai, chỉ trả Offer ACTIVE).
// Nút "Đăng ký" đi tới /member/checkout/:offerId (tạo đơn + thanh toán).
//
// Member có Membership ACTIVE vẫn được mua một gói gia hạn. Nút chỉ bị khóa
// khi caller phát hiện gói RESERVED hoặc đơn PENDING_PAYMENT hiện hữu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import {
  buildFeatures,
  computeOfferPricing,
  findBestSavingsOfferId,
  formatDuration,
  isDisplayableOffer,
} from '../../public/offers/offerUtils';
import './MemberOfferSection.css';

function categoryRank(label = '') {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'BASIC') return 0;
  if (normalized === 'PLUS') return 1;
  if (normalized === 'PREMIUM') return 2;
  return 3;
}

export default function MemberOfferSection({ blockedReason = null }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

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

  const categoryOptions = useMemo(() => {
    const options = new Map();
    offers.forEach((offer) => {
      const value = offer.planCode || offer.planDisplayName || 'OTHER';
      if (!options.has(value)) {
        options.set(value, offer.planDisplayName || offer.planCode || 'Gói khác');
      }
    });

    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort(
        (a, b) =>
          categoryRank(a.label) - categoryRank(b.label) ||
          a.label.localeCompare(b.label, 'vi'),
      );
  }, [offers]);

  // Sắp xếp theo thời hạn, sau đó theo tên loại gói động.
  const sorted = useMemo(() => {
    return [...offers].sort(
      (a, b) =>
        Number(a.durationDays) - Number(b.durationDays) ||
        (a.planDisplayName || a.planCode || '').localeCompare(
          b.planDisplayName || b.planCode || '',
          'vi',
        ),
    );
  }, [offers]);

  const filtered = useMemo(() => {
    const minimum = minPrice === '' ? null : Number(minPrice);
    const maximum = maxPrice === '' ? null : Number(maxPrice);

    return sorted.filter((offer) => {
      const price = Number(offer.priceAmount);

      return (
        (!category ||
          (offer.planCode || offer.planDisplayName || 'OTHER') === category) &&
        (minimum == null || price >= minimum) &&
        (maximum == null || price <= maximum)
      );
    });
  }, [category, maxPrice, minPrice, sorted]);

  const groupedFiltered = useMemo(() => {
    const groups = new Map();

    filtered.forEach((offer) => {
      const key = offer.planCode || offer.planDisplayName || 'OTHER';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: offer.planDisplayName || offer.planCode || 'Gói khác',
          offers: [],
        });
      }
      groups.get(key).offers.push(offer);
    });

    return [...groups.values()].sort(
      (a, b) =>
        categoryRank(a.label) - categoryRank(b.label) ||
        a.label.localeCompare(b.label, 'vi'),
    );
  }, [filtered]);

  const hasFilters = category !== '' || minPrice !== '' || maxPrice !== '';

  function clearFilters() {
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
  }

  return (
    <section id="member-offers" className="scms-mo">
      <h2 className="scms-mo-title">Đăng ký gói tập</h2>
      <p className="scms-mo-sub">
        Chọn gói phù hợp, bấm &quot;Đăng ký&quot; để tạo đơn và thanh toán.
      </p>

      {blockedReason ? (
        <div className="scms-mo-note">{blockedReason}</div>
      ) : null}

      <div className="scms-mo-filters" role="search" aria-label="Lọc gói tập">
        <div className="scms-mo-category-filter">
          <span>Loại gói</span>
          <div className="scms-mo-category-options" aria-label="Chọn loại gói">
            <button
              type="button"
              className={category === '' ? 'active' : ''}
              aria-pressed={category === ''}
              onClick={() => setCategory('')}
            >
              Tất cả
            </button>
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={category === option.value ? 'active' : ''}
                aria-pressed={category === option.value}
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="scms-mo-filter">
          <span>Giá từ</span>
          <input
            type="number"
            min="0"
            step="1000"
            inputMode="numeric"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="0 đ"
          />
        </label>
        <label className="scms-mo-filter">
          <span>Giá đến</span>
          <input
            type="number"
            min="0"
            step="1000"
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Không giới hạn"
          />
        </label>
        <button
          type="button"
          className="scms-mo-clear"
          onClick={clearFilters}
          disabled={!hasFilters}
        >
          Xóa bộ lọc
        </button>
      </div>

      {!loading && !error && offers.length > 0 ? (
        <p className="scms-mo-result-count">
          Hiển thị {filtered.length}/{offers.length} gói tập
        </p>
      ) : null}

      <ErrorAlert error={error} title="Không tải được danh sách gói tập" />

      {loading ? (
        <div className="scms-mo-center">
          <Spinner animation="border" size="sm" /> Đang tải gói tập…
        </div>
      ) : offers.length === 0 && !error ? (
        <div className="scms-mo-empty">
          Hiện chưa có gói tập nào đang mở bán. Vui lòng liên hệ lễ tân để được
          tư vấn.
        </div>
      ) : filtered.length === 0 && !error ? (
        <div className="scms-mo-empty">
          Không tìm thấy gói tập phù hợp với bộ lọc hiện tại.
          <button type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="scms-mo-categories">
          {groupedFiltered.map((category) => (
            <section key={category.key} className="scms-mo-category">
              <div className="scms-mo-category-head">
                <h3>{category.label}</h3>
                <span>{category.offers.length} lựa chọn</span>
              </div>
              <div className="scms-mo-grid">
                {category.offers.map((offer) => {
                  const info = pricing.get(offer.offerId);
                  const showPerMonth =
                    info?.perMonth && Number(offer.durationDays) !== 30;
                  return (
                    <article key={offer.offerId} className="scms-mo-card">
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
                      <h4 className="scms-mo-name">{offer.name}</h4>
                      {offer.description ? (
                        <p className="scms-mo-desc">{offer.description}</p>
                      ) : null}
                      <div className="scms-mo-price">
                        {formatPrice(offer.priceAmount, offer.currencyCode)}
                        <small> / {formatDuration(offer.durationDays)}</small>
                      </div>
                      <div
                        className={`scms-mo-permonth${
                          showPerMonth ? '' : ' empty'
                        }`}
                        aria-hidden={!showPerMonth}
                      >
                        {showPerMonth ? (
                          <>
                            ≈ {formatPrice(info.perMonth, offer.currencyCode)} / tháng
                            {info.savings > 0
                              ? ` · Tiết kiệm ${info.savings}%`
                              : ''}
                          </>
                        ) : (
                          '\u00a0'
                        )}
                      </div>
                      <ul className="scms-mo-feat">
                        {buildFeatures(offer).map((feature) => (
                          <li
                            key={feature.code || feature.text}
                            className={feature.ok ? '' : 'off'}
                          >
                            {feature.ok ? '✓' : '–'} {feature.text}
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
                          className="scms-mo-btn primary"
                        >
                          Đăng ký
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
