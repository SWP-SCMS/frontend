// Manager – Membership Offer list & search (US08).
//
// BE: GET /api/v1/manager/membership-offers
//     -> MembershipOfferResponse[] (no pagination wrapper; plain array)
//   Each item: offerId, planCode, planDisplayName, name, description,
//   priceAmount (BigInteger), currencyCode, durationDays,
//   supportsBooking, supportsPersonalCoaching.
//
// NOTE: MembershipOfferResponse does NOT include a `status` field. We
// keep the status filter on the FE for when the backend exposes it, but
// the badge currently renders "—" because the value isn't returned.
//
// Filters:
//   - planCode: BASIC | PLUS | ALL
//   - status:   ACTIVE | INACTIVE | ALL (currently client-only; BE list
//     already returns only items visible to admin — INACTIVE is included)
//   - free-text query against name + description (client-side filter).

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  Spinner,
  Table,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listMembershipOffersAdmin } from '../../../services/membershipOfferAdminService';
import { formatPrice } from '../../../utils';

const PLAN_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'BASIC', label: 'BASIC' },
  { value: 'PLUS', label: 'PLUS' },
];

// status filter is FE-side until backend returns member status fields.
const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

const PLAN_BADGE = {
  BASIC: 'bg-info-subtle text-info-emphasis',
  PLUS: 'bg-warning-subtle text-warning-emphasis',
};

function readStringParam(params, name) {
  const v = params.get(name);
  return v ? v : '';
}

export default function MembershipOfferListPage() {
  const [params, setParams] = useSearchParams();

  const query = readStringParam(params, 'query');
  const plan = readStringParam(params, 'plan');
  const status = readStringParam(params, 'status');

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

    listMembershipOffersAdmin()
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
      // status filter is currently FE-only because backend response
      // does not surface status. We only apply it when explicitly
      // requested, but no row is filtered out here.
      if (status && o.status && o.status !== status) return false;
      if (q) {
        const hay = `${o.name || ''} ${o.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offers, query, plan, status]);

  const tableBody = useMemo(() => {
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
              ? 'Chưa có gói tập nào. Bấm "Tạo gói tập" để bắt đầu.'
              : 'Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm.'
          }
        />
      );
    }
    return (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Tên gói tập</th>
            <th>Loại</th>
            <th>Giá</th>
            <th>Thời hạn</th>
            <th>Trạng thái</th>
            <th className="text-end">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.offerId}>
              <td>
                <Link
                  to={`/manager/membership-offers/${row.offerId}`}
                  className="text-decoration-none fw-semibold"
                >
                  {row.name || '—'}
                </Link>
                {row.description ? (
                  <div className="text-muted small text-truncate" style={{ maxWidth: 320 }}>
                    {row.description}
                  </div>
                ) : null}
              </td>
              <td>
                <span
                  className={`badge ${
                    PLAN_BADGE[row.planCode] || 'bg-light text-dark'
                  }`}
                >
                  {row.planCode || '—'}
                </span>
              </td>
              <td>{formatPrice(row.priceAmount, row.currencyCode)}</td>
              <td>
                {row.durationDays ? `${row.durationDays} ngày` : '—'}
              </td>
              <td>
                <span
                  className={`badge ${
                    STATUS_BADGE[row.status] || 'bg-light text-dark'
                  }`}
                >
                  {row.status || '—'}
                </span>
              </td>
              <td className="text-end">
                <Button
                  as={Link}
                  to={`/manager/membership-offers/${row.offerId}`}
                  variant="outline-danger"
                  size="sm"
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }, [loading, filtered, offers.length]);

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Quản lý gói tập</h1>
          <p className="text-muted mb-0">
            Tạo và cập nhật các gói tập BASIC / PLUS hiển thị cho hội viên.
          </p>
        </div>
        <Button
          as={Link}
          to="/manager/membership-offers/new"
          variant="danger"
        >
          + Tạo gói tập
        </Button>
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

        <div>
          <div className="text-muted small mb-1">Trạng thái</div>
          <ButtonGroup size="sm">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value || 'all-status'}
                variant={status === f.value ? 'danger' : 'outline-danger'}
                onClick={() => setParam('status', f.value)}
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

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">{tableBody}</div>
        {!loading && filtered.length > 0 ? (
          <div className="px-3 py-2 border-top text-muted small">
            Hiển thị {filtered.length} / {offers.length} gói tập
          </div>
        ) : null}
      </div>
    </div>
  );
}