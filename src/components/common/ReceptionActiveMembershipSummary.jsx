import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { formatDate } from '../../utils';

export default function ReceptionActiveMembershipSummary({ membership, memberCode }) {
  if (!membership) {
    return (
      <Alert variant="warning" className="mt-3 mb-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <span>Hội viên chưa có gói tập đang hoạt động.</span>
        <Button
          as={Link}
          to={`/reception/orders/new?memberId=${encodeURIComponent(memberCode || '')}`}
          size="sm"
          variant="outline-danger"
        >
          Tạo đơn gói tập
        </Button>
      </Alert>
    );
  }

  return (
    <Alert variant={membership.frozen ? 'warning' : 'success'} className="mt-3 mb-0">
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <div>
          <div className="fw-semibold">{membership.offerName || membership.planName || 'Gói tập hiện tại'}</div>
          <div className="small">
            {membership.planName ? `Loại ${membership.planName} · ` : ''}
            {formatDate(membership.effectiveStartDate)} – {formatDate(membership.effectiveEndDate)}
          </div>
        </div>
        <span className={`badge align-self-start ${membership.frozen ? 'text-bg-warning' : 'text-bg-success'}`}>
          {membership.frozen ? 'Đang đóng băng' : 'Đang hoạt động'}
        </span>
      </div>
    </Alert>
  );
}
