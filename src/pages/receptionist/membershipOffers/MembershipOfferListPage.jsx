// Receptionist – Membership Offer list (US12).
//
// BE: GET /api/v1/membership-offers?planCode={dynamicPlanCode}
//     -> MembershipOfferSummary[] (plain array, NOT paginated)
//   Each item: offerId, planCode, planDisplayName, name, description,
//   priceAmount, currencyCode, durationDays, supportsBooking,
//   supportsPersonalCoaching.
//
// This endpoint is shared with MEMBER — the backend authorises either role —
// so we reuse membershipService.listActiveOffers rather than declaring a
// duplicate receptionist-only wrapper. Only ACTIVE offers are ever returned.
//
// `planCode` is sent to the server as a real filter (the backend 400s on an
// unknown code). The free-text name/description search below is client-side
// only, because the contract has no text-search parameter.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  Spinner,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import {
  buildFeatures,
  computeOfferPricing,
  formatDuration,
} from '../../public/offers/offerUtils';
import './MembershipOfferListPage.css';

function categoryRank(label = '') {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'BASIC') return 0;
  if (normalized === 'PLUS') return 1;
  if (normalized === 'PREMIUM') return 2;
  return 3;
}

function readStringParam(params, name) {
  const v = params.get(name);
  return v ? v : '';
}

export default function MembershipOfferListPage() {
  const [params, setParams] = useSearchParams();

  const query = readStringParam(params, 'query');
  const plan = readStringParam(params, 'planCode');

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listActiveOffers()
      .then((result) => {
        if (cancelled) return;
        setOffers(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function setParam(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  function handleSubmitSearch(e) {
    e.preventDefault();
    setParam('query', searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput('');
    setParam('query', '');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter((o) => {
      if (plan && o.planCode !== plan) return false;
      if (q) {
        const hay = `${o.name || ''} ${o.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offers, query, plan]);

  const planFilters = useMemo(() => {
    const unique = new Map();
    offers.forEach((offer) => unique.set(offer.planCode, offer.planDisplayName || offer.planCode));
    return [{ value: '', label: 'Tất cả' }, ...[...unique.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi')).map(([value, label]) => ({ value, label }))];
  }, [offers]);

  const pricing = useMemo(() => computeOfferPricing(offers), [offers]);

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

    groups.forEach((group) => {
      group.offers.sort(
        (a, b) =>
          Number(a.durationDays) - Number(b.durationDays) ||
          Number(a.priceAmount) - Number(b.priceAmount) ||
          (a.name || '').localeCompare(b.name || '', 'vi'),
      );
    });

    return [...groups.values()].sort(
      (a, b) =>
        categoryRank(a.label) - categoryRank(b.label) ||
        a.label.localeCompare(b.label, 'vi'),
    );
  }, [filtered]);

  const cardBody = useMemo(() => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          title="Không có gói tập phù hợp"
          message={
            offers.length === 0
              ? 'Chưa có gói tập nào đang hoạt động.'
              : 'Thử bỏ bộ lọc hoặc đổi từ khóa tìm kiếm.'
          }
        />
      );
    }
    return (
      <div className="scms-ro-categories">
        {groupedFiltered.map((category) => (
          <section key={category.key} className="scms-ro-category">
            <div className="scms-ro-category-head">
              <h2>{category.label}</h2>
              <span>{category.offers.length} lựa chọn</span>
            </div>
            <div className="scms-ro-grid">
              {category.offers.map((offer) => {
                const info = pricing.get(offer.offerId);
                const showPerMonth =
                  info?.perMonth && Number(offer.durationDays) !== 30;

                return (
                  <article key={offer.offerId} className="scms-ro-card">
                    <div className="scms-ro-card-top">
                      <span className="scms-ro-plan">
                        {offer.planDisplayName || offer.planCode || 'Gói tập'}
                      </span>
                      <span className="scms-ro-duration">
                        {formatDuration(offer.durationDays)}
                      </span>
                    </div>
                    <h3>{offer.name || '—'}</h3>
                    {offer.description ? (
                      <p className="scms-ro-description">{offer.description}</p>
                    ) : null}
                    <div className="scms-ro-price">
                      {formatPrice(offer.priceAmount, offer.currencyCode)}
                      <small> / {formatDuration(offer.durationDays)}</small>
                    </div>
                    <div
                      className={`scms-ro-per-month${showPerMonth ? '' : ' empty'}`}
                      aria-hidden={!showPerMonth}
                    >
                      {showPerMonth ? (
                        <>
                          ≈ {formatPrice(info.perMonth, offer.currencyCode)} / tháng
                          {info.savings > 0 ? ` · Tiết kiệm ${info.savings}%` : ''}
                        </>
                      ) : (
                        '\u00a0'
                      )}
                    </div>
                    <ul className="scms-ro-benefits">
                      {buildFeatures(offer).map((feature) => (
                        <li
                          key={feature.code || feature.text}
                          className={feature.ok ? '' : 'off'}
                        >
                          <span aria-hidden="true">{feature.ok ? '✓' : '–'}</span>
                          {feature.text}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }, [groupedFiltered, loading, offers.length, pricing]);

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Gói tập</h1>
        <p className="text-muted mb-0">
          Danh sách gói tập ACTIVE đang được bán tại quầy.
        </p>
      </header>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <Form
          onSubmit={handleSubmitSearch}
          style={{ maxWidth: 360, flexGrow: 1 }}
        >
          <InputGroup size="sm">
            <Form.Control
              type="search"
              placeholder="Tìm theo tên hoặc mô tả…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={200}
              aria-label="Tìm kiếm gói tập"
            />
            <Button type="submit" variant="outline-danger">
              Tìm
            </Button>
            {searchInput ? (
              <Button
                type="button"
                variant="outline-secondary"
                onClick={handleClearSearch}
                aria-label="Xóa tìm kiếm"
              >
                ✕
              </Button>
            ) : null}
          </InputGroup>
        </Form>

        <div>
          <div className="text-muted small mb-1">Loại gói</div>
          <ButtonGroup size="sm">
            {planFilters.map((f) => (
              <Button
                key={f.value || 'all-plan'}
                variant={plan === f.value ? 'danger' : 'outline-danger'}
                onClick={() => setParam('planCode', f.value)}
              >
                {f.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <ErrorAlert
        error={error}
        title="Không tải được danh sách gói tập"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      {cardBody}

      {!loading && filtered.length > 0 ? (
        <div className="text-muted small mt-2">
          Hiển thị {filtered.length} / {offers.length} gói tập
        </div>
      ) : null}
    </div>
  );
}
