import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Form, Spinner, Table } from 'react-bootstrap';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listMembershipPlans } from '../../../services/membershipPlanService';
import { formatDate } from '../../../utils';
import { PLAN_STATUS_BADGE, PLAN_STATUS_OPTIONS } from './membershipPlanUi';

export default function MembershipPlanListPage() {
  const [plans, setPlans] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listMembershipPlans()
      .then(setPlans)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return plans.filter((plan) => {
      if (status && plan.status !== status) return false;
      return !keyword || `${plan.code} ${plan.displayName}`.toLowerCase().includes(keyword);
    });
  }, [plans, query, status]);

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1">Loại gói & quyền lợi</h1>
          <p className="text-muted mb-0">Quản lý các loại gói động dùng cho gói bán và đơn hội viên.</p>
        </div>
        <Button as={Link} to="/manager/membership-plans/new" variant="danger">
          + Tạo loại gói
        </Button>
      </header>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          style={{ maxWidth: 360 }}
          type="search"
          value={query}
          placeholder="Tìm theo mã hoặc tên…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Form.Select
          style={{ maxWidth: 220 }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {PLAN_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Form.Select>
      </div>
      <ErrorAlert error={error} title="Không tải được danh sách loại gói" />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có loại gói phù hợp" message="Thử đổi bộ lọc hoặc tạo loại gói mới." />
      ) : (
        <div className="card border-0 shadow-sm">
          <Table hover responsive className="align-middle mb-0">
            <thead className="table-light"><tr><th>Mã</th><th>Tên hiển thị</th><th>Quyền lợi</th><th>Trạng thái</th><th>Cập nhật</th><th /></tr></thead>
            <tbody>
              {filtered.map((plan) => (
                <tr key={plan.code}>
                  <td><code>{plan.code}</code></td>
                  <td className="fw-semibold">{plan.displayName}</td>
                  <td>{plan.benefitCodes?.length || 0} quyền lợi</td>
                  <td><span className={`badge ${PLAN_STATUS_BADGE[plan.status] || 'bg-light text-dark'}`}>{plan.status}</span></td>
                  <td>{formatDate(plan.updatedAt)}</td>
                  <td className="text-end"><Button as={Link} to={`/manager/membership-plans/${plan.code}`} size="sm" variant="outline-danger">Chi tiết</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
