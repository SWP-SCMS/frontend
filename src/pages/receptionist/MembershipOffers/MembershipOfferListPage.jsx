// Receptionist – Membership Offer list (US12).
//
// BE: GET /api/v1/membership-offers?planCode=BASIC|PLUS
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
  Card,
  Form,
  InputGroup,
  Spinner,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listActiveOffers } from '../../../services/membershipService';
import { MEMBERSHIP_PLAN } from '../../../constants';
import { formatPrice } from '../../../utils';

const PLAN_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: MEMBERSHIP_PLAN.BASIC, label: 'BASIC' },
  { value: MEMBERSHIP_PLAN.PLUS, label: 'PLUS' },
];

const PLAN_BADGE = {
  [MEMBERSHIP_PLAN.BASIC]: 'bg-info-subtle text-info-emphasis',
  [MEMBERSHIP_PLAN.PLUS]: 'bg-warning-subtle text-warning-emphasis',
};

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

    listActiveOffers(plan ? { planCode: plan } : {})
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
  }, [plan]);

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
              : 'Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm.'
          }
        />
      );
    }
    return (
      <div className="d-flex flex-column gap-3">
        {filtered.map((offer) => (
          <Card key={offer.offerId} className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <span className={`badge me-2 ${
                    PLAN_BADGE[offer.planCode] || 'bg-light text-dark'
                  }`}>
                    {offer.planCode || '—'}
                  </span>
                  <span className="fw-semibold">{offer.name || '—'}</span>
                  {offer.planDisplayName ? (
                    <span className="text-muted ms-1">· {offer.planDisplayName}</span>
                  ) : null}
                </div>
                <div className="text-end">
                  <div className="fw-bold text-danger">
                    {formatPrice(offer.priceAmount, offer.currencyCode)}
                  </div>
                  <small className="text-muted">
                    {offer.durationDays ? `${offer.durationDays} ngày` : '—'}
                  </small>
                </div>
              </div>
              {offer.description ? (
                <p className="text-muted small mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                  {offer.description}
                </p>
              ) : null}
              <div className="d-flex flex-wrap gap-3">
                <small className="text-muted">
                  {offer.supportsBooking ? '✓ Đặt lịch online' : '✗ Không hỗ trợ đặt lịch'}
                </small>
                <small className="text-muted">
                  {offer.supportsPersonalCoaching ? '✓ Coaching 1-1' : '✗ Không hỗ trợ Coaching 1-1'}
                </small>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  }, [loading, filtered, offers.length]);

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
                aria-label="Xoá tìm kiếm"
              >
                ✕
              </Button>
            ) : null}
          </InputGroup>
        </Form>

        <div>
          <div className="text-muted small mb-1">Loại gói</div>
          <ButtonGroup size="sm">
            {PLAN_FILTERS.map((f) => (
              <Button
                key={f.value || 'all-plan'}
                variant={plan === f.value ? 'danger' : 'outline-danger'}
                onClick={() => setParam('plan', f.value)}
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
