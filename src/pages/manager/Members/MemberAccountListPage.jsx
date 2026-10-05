// Manager – Member account list & search (US06).
//
// BE: GET /api/v1/manager/members?query&status&page&size
//     -> { content: MemberAccountResponse[], page, size, totalElements, totalPages }
//     Manager-only. Status: ACTIVE | INACTIVE | SUSPENDED.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup, Form, InputGroup, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { searchMemberAccounts } from '../../../services/memberAccountService';
import { ACCOUNT_STATUS } from '../../../constants';
import { formatDate } from '../../../utils';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: ACCOUNT_STATUS.ACTIVE, label: 'Đang hoạt động' },
  { value: ACCOUNT_STATUS.INACTIVE, label: 'Ngưng hoạt động' },
  { value: ACCOUNT_STATUS.SUSPENDED, label: 'Tạm khoá' },
];

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.INACTIVE]: 'bg-secondary-subtle text-secondary-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
};

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

function readNumberParam(params, name, fallback) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readStringParam(params, name) {
  const v = params.get(name);
  return v ? v : '';
}

export default function MemberAccountListPage() {
  const [params, setParams] = useSearchParams();

  const query = readStringParam(params, 'query');
  const status = readStringParam(params, 'status');
  const page = Math.max(0, readNumberParam(params, 'page', 0));

  const [data, setData] = useState(EMPTY_PAGE);
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

    searchMemberAccounts({
      query: query || undefined,
      status: status || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
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
  }, [query, status, page]);

  function setParam(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
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

  const rows = data.content ?? [];
  const totalPages = Math.max(1, data.totalPages || 1);
  const canPrev = page > 0;
  const canNext = data.totalPages > 0 && page < data.totalPages - 1;

  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          title="Không có hội viên phù hợp"
          message="Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm."
        />
      );
    }
    return (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Họ tên</th>
            <th>Trạng thái</th>
            <th>Số điện thoại</th>
            <th>Email</th>
            <th>Ngày sinh</th>
            <th className="text-end">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountId}>
              <td>
                <Link
                  to={`/manager/members/${row.accountId}`}
                  className="text-decoration-none fw-semibold"
                >
                  {row.fullName || '—'}
                </Link>
              </td>
              <td>
                <span className={`badge ${STATUS_BADGE[row.status] || 'bg-light text-dark'}`}>
                  {row.status || '—'}
                </span>
              </td>
              <td>{row.phone || '—'}</td>
              <td>{row.email || '—'}</td>
              <td>{formatDate(row.birthDate)}</td>
              <td className="text-end">
                <Button
                  as={Link}
                  to={`/manager/members/${row.accountId}`}
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
  }, [loading, rows]);

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Hội viên</h1>
          <p className="text-muted mb-0">
            Danh sách tài khoản MEMBER và trạng thái hoạt động tương ứng.
          </p>
        </div>
      </header>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <Form onSubmit={handleSubmitSearch} style={{ maxWidth: 360, flexGrow: 1 }}>
          <InputGroup size="sm">
            <Form.Control
              type="search"
              placeholder="Tìm theo họ tên, SĐT, email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
              aria-label="Tìm kiếm hội viên"
            />
            <Button type="submit" variant="outline-danger">
              Tìm
            </Button>
            {searchInput ? (
              <Button type="button" variant="outline-secondary" onClick={handleClearSearch} aria-label="Xoá tìm kiếm">
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
        title="Không tải được danh sách hội viên"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">{tableBody}</div>
        {rows.length > 0 ? (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
            <small className="text-muted">
              Trang {page + 1} / {totalPages} · Tổng {data.totalElements} hội viên
            </small>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canPrev || loading}
                onClick={() => setParam('page', String(Math.max(0, page - 1)))}
              >
                ← Trang trước
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canNext || loading}
                onClick={() => setParam('page', String(page + 1))}
              >
                Trang sau →
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}