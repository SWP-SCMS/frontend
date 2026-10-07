// Manager – Discipline list & search (US23).
//
// BE: GET /api/v1/manager/disciplines
//     -> DisciplineResponse[] (no pagination wrapper; plain array)
//   Each item: { id, name, description, status } where status ∈
//   { 'ACTIVE', 'INACTIVE' }. No createdAt / updatedAt / version on the
//   response.
//
// Filters:
//   - status: ACTIVE | INACTIVE | ALL  (client-side only; the BE does not
//     accept any query parameter on this endpoint — see plan §C-5).
//   - free-text query against name + description (client-side filter).
//
// Search/filter state is bound to the URL (?query, ?status) for shareable /
// refresh-safe links, mirroring MembershipOfferListPage.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup, Form, InputGroup, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listDisciplines } from '../../../services/disciplineService';

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

function readStringParam(params, name) {
  const v = params.get(name);
  return v ? v : '';
}

export default function DisciplineListPage() {
  const [params, setParams] = useSearchParams();

  const query = readStringParam(params, 'query');
  const status = readStringParam(params, 'status');

  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(query);

  // Mirror URL -> local input (e.g. user navigates with the back button).
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Single fetch on mount. Filter / search is purely client-side.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listDisciplines()
      .then((result) => {
        if (cancelled) return;
        setDisciplines(result);
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
    return disciplines.filter((d) => {
      if (status && d.status !== status) return false;
      if (q) {
        const hay = `${d.name || ''} ${d.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [disciplines, query, status]);

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
          title="Không có bộ môn phù hợp"
          message={
            disciplines.length === 0
              ? 'Chưa có bộ môn nào. Bấm "Tạo bộ môn" để bắt đầu.'
              : 'Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm.'
          }
        />
      );
    }
    return (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Tên bộ môn</th>
            <th>Mô tả</th>
            <th>Trạng thái</th>
            <th className="text-end">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to={`/manager/disciplines/${row.id}`}
                  className="text-decoration-none fw-semibold"
                >
                  {row.name || '—'}
                </Link>
              </td>
              <td>
                {row.description ? (
                  <div
                    className="text-muted small text-truncate"
                    style={{ maxWidth: 360 }}
                  >
                    {row.description}
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                )}
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
                  to={`/manager/disciplines/${row.id}`}
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
  }, [loading, filtered, disciplines.length]);

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Bộ môn</h1>
          <p className="text-muted mb-0">
            Quản lý các bộ môn đào tạo (Yoga, Boxing, Muay Thái, …).
          </p>
        </div>
        <Button
          as={Link}
          to="/manager/disciplines/new"
          variant="danger"
        >
          + Tạo bộ môn
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
              maxLength={100}
              aria-label="Tìm kiếm bộ môn"
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
        title="Không tải được danh sách bộ môn"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">{tableBody}</div>
        {!loading && filtered.length > 0 ? (
          <div className="px-3 py-2 border-top text-muted small">
            Hiển thị {filtered.length} / {disciplines.length} bộ môn
          </div>
        ) : null}
      </div>
    </div>
  );
}