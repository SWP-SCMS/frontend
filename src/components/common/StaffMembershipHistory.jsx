import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from './ErrorAlert';
import MembershipBenefitList from './MembershipBenefitList';
import {
  getManagerMemberMemberships,
  getReceptionMemberMemberships,
} from '../../services/staffMembershipService';
import { formatDateTime } from '../../utils';
import { hasBenefitContract } from '../../utils/membershipBenefits';

const STATUS_LABELS = {
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Đã hết hạn',
};

const STATUS_VARIANTS = {
  ACTIVE: 'success',
  EXPIRED: 'secondary',
};

export default function StaffMembershipHistory({
  managerMemberAccountId,
  receptionMemberCode,
}) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (managerMemberAccountId) {
        data = await getManagerMemberMemberships(managerMemberAccountId);
      } else if (receptionMemberCode) {
        data = await getReceptionMemberMemberships(receptionMemberCode);
      } else {
        throw new Error('Thiếu định danh hội viên để tải lịch sử gói tập.');
      }
      setMemberships(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [managerMemberAccountId, receptionMemberCode]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="border-0 shadow-sm mt-3">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 className="h6 text-uppercase text-muted mb-1">Lịch sử gói tập</h2>
            <p className="small text-muted mb-0">
              Thông tin được giữ theo gói đã mua, không phụ thuộc thay đổi của ưu đãi hiện tại.
            </p>
          </div>
          {!loading && error ? (
            <Button type="button" variant="outline-danger" size="sm" onClick={load}>
              Thử lại
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="d-flex align-items-center gap-2 text-muted small py-3" role="status">
            <Spinner animation="border" size="sm" />
            Đang tải lịch sử gói tập...
          </div>
        ) : null}

        {!loading && error ? (
          <ErrorAlert error={error} title="Không tải được lịch sử gói tập" />
        ) : null}

        {!loading && !error && memberships.length === 0 ? (
          <p className="text-muted small mb-0">Hội viên chưa có gói tập nào.</p>
        ) : null}

        {!loading && !error && memberships.length > 0 ? (
          <div className="table-responsive">
            <Table size="sm" className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Gói đã mua</th>
                  <th>Loại gói</th>
                  <th>Trạng thái</th>
                  <th>Quyền lợi</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.membershipId}>
                    <td className="fw-semibold">{membership.offerName || '—'}</td>
                    <td>{membership.planCode || '—'}</td>
                    <td>
                      <Badge bg={STATUS_VARIANTS[membership.status] || 'light'}
                        text={STATUS_VARIANTS[membership.status] ? undefined : 'dark'}>
                        {STATUS_LABELS[membership.status] || membership.status || '—'}
                      </Badge>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <MembershipBenefitList
                        benefitCodes={membership.benefitCodes}
                        benefits={membership.benefits}
                        emptyMessage={
                          hasBenefitContract(membership)
                            ? 'Không có quyền lợi'
                            : 'Chưa có dữ liệu quyền lợi'
                        }
                      />
                    </td>
                    <td>{formatDateTime(membership.startsAt)}</td>
                    <td>{formatDateTime(membership.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
      </Card.Body>
    </Card>
  );
}
