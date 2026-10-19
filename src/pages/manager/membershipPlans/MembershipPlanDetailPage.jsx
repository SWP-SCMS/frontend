import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getMembershipPlan, listMembershipBenefits } from '../../../services/membershipPlanService';
import { formatDate } from '../../../utils';
import { benefitLabel, PLAN_STATUS_BADGE } from './membershipPlanUi';

export default function MembershipPlanDetailPage() {
  const { planCode } = useParams();
  const [plan, setPlan] = useState(null);
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getMembershipPlan(planCode), listMembershipBenefits()])
      .then(([nextPlan, catalog]) => { setPlan(nextPlan); setBenefits(catalog); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [planCode]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (error || !plan) return <ErrorAlert error={error} title="Không tải được loại gói" />;

  const benefitMap = new Map(benefits.map((benefit) => [benefit.code, benefit]));
  return (
    <div>
      <Link to="/manager/membership-plans" className="small text-decoration-none">← Quay lại danh sách</Link>
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-2 mt-2 mb-3">
        <div><h1 className="h3 fw-bold mb-1">{plan.displayName}</h1><code>{plan.code}</code></div>
        <Button as={Link} to={`/manager/membership-plans/${plan.code}/edit`} variant="outline-danger">Chỉnh sửa</Button>
      </header>
      <Card className="border-0 shadow-sm mb-3"><Card.Body>
        <dl className="row mb-0">
          <dt className="col-sm-3 text-muted fw-normal">Trạng thái</dt><dd className="col-sm-9"><span className={`badge ${PLAN_STATUS_BADGE[plan.status]}`}>{plan.status}</span></dd>
          <dt className="col-sm-3 text-muted fw-normal">Ngày tạo</dt><dd className="col-sm-9">{formatDate(plan.createdAt)}</dd>
          <dt className="col-sm-3 text-muted fw-normal">Cập nhật</dt><dd className="col-sm-9">{formatDate(plan.updatedAt)}</dd>
          <dt className="col-sm-3 text-muted fw-normal">Phiên bản</dt><dd className="col-sm-9 mb-0">{plan.version ?? '—'}</dd>
        </dl>
      </Card.Body></Card>
      <Card className="border-0 shadow-sm"><Card.Body>
        <h2 className="h5">Quyền lợi</h2>
        <ul className="mb-0">
          {plan.benefitCodes?.map((code) => <li key={code}><strong>{benefitLabel(benefitMap.get(code) || { code })}</strong> <span className="text-muted">({code})</span></li>)}
        </ul>
      </Card.Body></Card>
    </div>
  );
}
