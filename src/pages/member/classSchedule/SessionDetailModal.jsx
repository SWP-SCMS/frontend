// Hộp thông tin đầy đủ của một buổi tập trong "Lịch của tôi".
//
// Dữ liệu lấy từ phần tử booking của GET /members/me/bookings:
//   className, classType, disciplineName, coachName, roomName,
//   startTime, endTime
// và hai trường DỰ KIẾN (BE chưa trả, đã nhờ BE bổ sung):
//   attendanceStatus  PRESENT | ABSENT     (BR-ATT-02/03)
//   coachFeedback     chuỗi nhận xét của coach (BR-FDB-02)
// Khi BE chưa trả hai trường này thì hiện "Chưa điểm danh" và
// "Coach chưa gửi nhận xét".

import { Modal } from 'react-bootstrap';
import {
  formatGymDayHeading,
  formatGymTime,
} from '../../../utils/gymTime';
import { isAttended } from './attendance';

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
};

// ----- Icon SVG nhỏ (không cài thư viện icon) -----
const ICONS = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  room: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  coach: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2M12 12v3M10.5 13.5h3" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  message: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="mcs-mrow">
      <span className="mcs-mrow-label">
        <Icon name={icon} />
        {label}
      </span>
      <span className="mcs-mrow-value">{children}</span>
    </div>
  );
}

export default function SessionDetailModal({ session, onClose }) {
  const s = session;
  const attended = isAttended(s);
  const feedback =
    typeof s?.coachFeedback === 'string' ? s.coachFeedback.trim() : '';
  const subtitle = [s?.disciplineName, CLASS_TYPE_LABEL[s?.classType]]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal
      show={Boolean(s)}
      onHide={onClose}
      centered
      dialogClassName="mcs-dialog"
      aria-labelledby="mcs-detail-title"
    >
      <Modal.Body className="mcs-modal">
        <div className="mcs-mhead">
          <div>
            <h2 className="mcs-mtitle" id="mcs-detail-title">
              {s?.className || '—'}
            </h2>
            {subtitle ? <p className="mcs-msub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="mcs-mclose"
            onClick={onClose}
            aria-label="Đóng"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mcs-mcard">
          <Row icon="calendar" label="Ngày:">
            {s ? formatGymDayHeading(s.startTime) : '—'}
          </Row>
          <Row icon="clock" label="Giờ học:">
            {formatGymTime(s?.startTime)} - {formatGymTime(s?.endTime)}
          </Row>
          <Row icon="coach" label="HLV phụ trách:">
            {s?.coachName || '—'}
          </Row>
          <Row icon="room" label="Phòng tập:">
            {s?.roomName || '—'}
          </Row>
          <Row icon="check" label="Điểm danh:">
            <span className={`mcs-att ${attended ? 'done' : 'todo'}`}>
              {attended ? 'Đã điểm danh' : 'Chưa điểm danh'}
            </span>
          </Row>
        </div>

        <div className="mcs-mfeedback">
          <div className="mcs-mfeedback-title">
            <Icon name="message" />
            Nhận xét của coach
          </div>
          {feedback ? (
            <p className="mcs-mfeedback-text">{feedback}</p>
          ) : (
            <p className="mcs-mfeedback-empty">Coach chưa gửi nhận xét.</p>
          )}
        </div>

        <div className="mcs-mactions">
          <button type="button" className="mcs-mbtn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
