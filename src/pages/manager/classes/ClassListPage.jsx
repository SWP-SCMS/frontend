// Manager – Class list (US24).
//
// BE: GET /api/v1/manager/classes
//     -> SportClassResponse[] (no pagination wrapper; plain array)
//   Each item:
//     { id, disciplineId, disciplineName, classType, description, status }
//   createdAt / updatedAt / version are NOT in the response DTO and are NOT
//   rendered here (per audit §D.1 / plan §L).
//
// Filters (client-side only; the BE does not accept any query parameter
// on this endpoint — see audit §G / plan §C):
//   - ?query  — free text against name + disciplineName + description.
//   - ?status — '' | 'ACTIVE' | 'INACTIVE'.
//
// US24 intentionally omits ?type and ?discipline filters (the columns
// `classType` and `disciplineName` are rendered on every row so the
// manager can read them directly).
//
// Search/filter state is URL-bound via useSearchParams so a deep link
// can be refreshed / shared — mirroring DisciplineListPage (US23).

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonGroup, Form, InputGroup, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listClasses } from '../../../services/sportClassService';

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

// classType -> Vietnamese label (plan §D.3). Falls back to the raw enum
// string for any value we don't know — same defensive pattern US23
// uses for status.
const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

function readStringParam(params, name) {
  const v = params.get(name);
  return v ? v : '';
}

export default function ClassListPage() {
  const [params, setParams] = useSearchParams();

  const query = readStringParam(params, 'query');
  const status = readStringParam(params, 'status');

  const [classes, setClasses] = useState([]);
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

    listClasses()
      .then((result) => {
        if (cancelled) return;
        setClasses(result);
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
    return classes.filter((c) => {
      if (status && c.status !== status) return false;
      if (q) {
        const hay =
          `${c.name || ''} ${c.disciplineName || ''} ${c.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [classes, query, status]);

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
          title="Không có lớp phù hợp"
          message={
            classes.length === 0
              ? 'Chưa có lớp học nào. Bấm "Tạo lớp" để bắt đầu.'
              : 'Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm.'
          }
        />
      );
    }
    return (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Tên lớp</th>
            <th>Bộ môn</th>
            <th>Loại</th>
            <th>Trạng thái</th>
            <th className="text-end">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to={`/manager/classes/${row.id}`}
                  className="text-decoration-none fw-semibold"
                >
                  {row.name || '—'}
                </Link>
              </td>
              <td>
                {row.disciplineName ? (
                  <span>{row.disciplineName}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>{TYPE_LABEL[row.classType] || row.classType || '—'}</td>
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
                  to={`/manager/classes/${row.id}`}
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
  }, [loading, filtered, classes.length]);

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Lớp học</h1>
          <p className="text-muted mb-0">
            Quản lý các lớp học theo bộ môn.
          </p>
        </div>
        <Button as={Link} to="/manager/classes/new" variant="danger">
          + Tạo lớp
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
              placeholder="Tìm theo tên, bộ môn hoặc mô tả…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
              aria-label="Tìm kiếm lớp học"
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
        title="Không tải được danh sách lớp học"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">{tableBody}</div>
        {!loading && filtered.length > 0 ? (
          <div className="px-3 py-2 border-top text-muted small">
            Hiển thị {filtered.length} / {classes.length} lớp
          </div>
        ) : null}
      </div>
    </div>
  );
}