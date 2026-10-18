import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';

import { getMyActiveCoachAssignment } from '../../services/coachAssignmentService';
import { formatGymDate, formatGymTime } from '../../utils/gymTime';

export default function MemberCoachCard() {
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyActiveCoachAssignment()
      .then((value) => {
        if (!cancelled) setCoach(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="my-coach" className="scms-md-card mb-3">
      <div className="scms-md-card-head">
        <div>
          <h2>Huấn luyện viên cá nhân</h2>
          <span className="sub">Thông tin HLV đang được phân công cho bạn.</span>
        </div>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" variant="danger" size="sm" />
          </div>
        ) : error ? (
          <Alert variant="danger" className="mb-0">
            Không tải được thông tin huấn luyện viên. Vui lòng thử lại sau.
          </Alert>
        ) : coach ? (
          <dl className="row mb-0">
            <dt className="col-sm-3 text-muted fw-normal">Họ và tên</dt>
            <dd className="col-sm-9 fw-semibold">{coach.coachFullName || '—'}</dd>
            <dt className="col-sm-3 text-muted fw-normal">Số điện thoại</dt>
            <dd className="col-sm-9">{coach.coachPhone || '—'}</dd>
            <dt className="col-sm-3 text-muted fw-normal">Email</dt>
            <dd className="col-sm-9">{coach.coachEmail || '—'}</dd>
            <dt className="col-sm-3 text-muted fw-normal">Phân công từ</dt>
            <dd className="col-sm-9 mb-0">
              {coach.startsAt
                ? `${formatGymDate(coach.startsAt)} · ${formatGymTime(coach.startsAt)}`
                : '—'}
            </dd>
          </dl>
        ) : (
          <p className="text-muted mb-0">
            Bạn chưa có huấn luyện viên cá nhân được phân công.
          </p>
        )}
      </div>
    </section>
  );
}
