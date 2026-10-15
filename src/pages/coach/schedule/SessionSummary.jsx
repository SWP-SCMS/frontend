// Khối thông tin buổi tập dùng chung cho 3 trang của một buổi dạy.

import { Badge } from 'react-bootstrap';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import { SESSION_STATUS_LABELS } from './sessionStatus';

// bare = không bọc khung thẻ (dùng trong hộp thoại).
export default function SessionSummary({ session, bare = false }) {
  const info = SESSION_STATUS_LABELS[session.status];
  return (
    <div className={bare ? "" : "scms-coach-card p-4 mb-3"}>
      <div className="d-flex align-items-center gap-2 mb-3">
        <h2 className="h5 mb-0">{session.className}</h2>
        {info ? <Badge bg={info.variant}>{info.text}</Badge> : null}
      </div>
      <dl className="row mb-0">
        <dt className="col-sm-3">Bộ môn</dt>
        <dd className="col-sm-9">{session.disciplineName || '—'}</dd>
        <dt className="col-sm-3">Ngày</dt>
        <dd className="col-sm-9">{formatGymDate(session.startTime)}</dd>
        <dt className="col-sm-3">Giờ</dt>
        <dd className="col-sm-9">
          {formatGymTime(session.startTime)} – {formatGymTime(session.endTime)}
        </dd>
        <dt className="col-sm-3">Phòng</dt>
        <dd className="col-sm-9">{session.roomName || '—'}</dd>
        <dt className="col-sm-3">Sĩ số</dt>
        <dd className="col-sm-9">
          {session.members?.length ?? 0} / {session.capacity}
        </dd>
        {session.status === 'CANCELLED' ? (
          <>
            <dt className="col-sm-3">Lý do hủy</dt>
            <dd className="col-sm-9">{session.cancellationReason || '—'}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
