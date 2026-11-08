import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { getLeaveReplacementCoaches } from '../../../services/coachLeaveService';
import { cancelSession, updateSessionAssignment } from '../../../services/classSessionService';
import { cancelManagerCourseSession, updateManagerCourseSession } from '../../../services/courseAdminService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const titles = { reassign: 'Đổi huấn luyện viên', cancel: 'Hủy buổi tập' };
function actionError(error) {
  const messages = {
    SESSION_HAS_MEMBERS: 'Buổi đã có hội viên đăng ký, không được hủy. Đóng form và tải lại danh sách để đổi HLV.',
    SESSION_VERSION_CONFLICT: 'Buổi tập đã được cập nhật ở nơi khác. Nội dung bạn nhập vẫn được giữ; đóng form rồi tải lại danh sách trước khi thử tiếp.',
    COURSE_SESSION_CHANGED: 'Buổi khóa học đã thay đổi. Đóng form và tải lại danh sách để xem dữ liệu mới nhất.',
    SESSION_CONFLICT: 'HLV hoặc phòng vừa phát sinh lịch trùng. Vui lòng kiểm tra lại.',
    PT_COACH_ASSIGNMENT_MISMATCH: 'HLV thay thế không phù hợp phân công PT của hội viên. Hãy kiểm tra lại phân công hoặc chọn cách xử lý khác.',
  };
  const message = messages[error?.response?.data?.code];
  return message ? new Error(message) : error;
}
export default function LeaveSessionActionModal({ request, session, action, onClose, onSaved }) {
  const course = session.type === 'COURSE';
  const [draft, setDraft] = useState({
    coachId: '', reason: `HLV ${request.coachFullName} xin nghỉ: ${request.reason}`.slice(0, 1000),
  });
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(action === 'reassign');
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (action !== 'reassign') return undefined;
    let active = true;
    getLeaveReplacementCoaches(request.id, session).then(value => { if (active) setCoaches(value); })
      .catch(error => { if (active) setLoadError(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.id, session, action]);

  function change(field, value) { setDraft(current => ({ ...current, [field]: value })); }

  async function submit(event) {
    event.preventDefault();
    if (lock.current || loading || loadError) return;
    setSaveError(null);
    if (action === 'cancel' && session.memberCount > 0) {
      setSaveError(new Error('Buổi đã có hội viên đăng ký, không được hủy. Vui lòng đổi HLV.')); return;
    }
    if (action === 'reassign' && !coaches.some(coach => coach.coachAccountId === draft.coachId)) {
      setSaveError(new Error('Vui lòng chọn HLV thay thế phù hợp.')); return;
    }
    if (!course && action !== 'reassign' && !draft.reason.trim()) {
      setSaveError(new Error('Vui lòng nhập lý do.')); return;
    }
    lock.current = true; setBusy(true);
    try {
      if (course) {
        if (action === 'reassign') await updateManagerCourseSession(session.courseRunId, session.id, {
          expectedVersion: session.version, coachId: draft.coachId, roomId: session.roomId,
          startAt: session.startTime, endAt: session.endTime,
        });
        else await cancelManagerCourseSession(session.courseRunId, session.id, session.version);
      } else if (action === 'reassign') await updateSessionAssignment(session.id, { coachId: draft.coachId, expectedVersion: session.version });
      else if (action === 'cancel') await cancelSession(session.id, { reason: draft.reason.trim() });
    } catch (error) { setSaveError(actionError(error)); return; }
    finally { lock.current = false; setBusy(false); }
    onSaved();
  }

  return <Modal show onHide={() => !busy && onClose()} centered size="lg" backdrop="static" keyboard={!busy}>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!busy}><Modal.Title className="h5">{titles[action]}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="fw-semibold mb-1">{session.name}{course ? ` · ${session.runCode} · Buổi ${session.unitNumber}` : ''}</p>
        <p className="text-muted">{formatGymDate(session.startTime)} · {formatGymTime(session.startTime)}–{formatGymTime(session.endTime)} · {session.roomName || 'Chưa phân phòng'} · {session.memberCount} học viên</p>
        <ErrorAlert error={loadError} title="Không tải được HLV thay thế" />
        <ErrorAlert error={saveError} title="Không xử lý được buổi tập" />
        {action === 'cancel' && <Alert variant="warning">{course ? 'Buổi khóa học này sẽ bị hủy và học viên được thông báo. Không tạo buổi bù; quyền lợi học viên được giữ để xử lý theo quy trình khóa học.' : 'Buổi này sẽ bị hủy. Các lượt đặt và hàng chờ được xử lý, học viên được thông báo theo quy trình hủy buổi tập.'}</Alert>}
        {session.type === 'PT' && action === 'reassign' && <Alert variant="info">Chỉ hiển thị HLV trống giờ và phù hợp phân công PT của các hội viên đã đặt hoặc đang chờ. Buổi đã có hội viên đăng ký chỉ được đổi HLV; nếu chưa có người phù hợp, cần xử lý phân công PT trước.</Alert>}
        <fieldset disabled={busy || loading || Boolean(loadError)}>
          {action === 'reassign' && <Form.Group controlId="leave-replacement-coach" className="mb-3">
            <Form.Label>HLV thay thế *</Form.Label>
            {loading && <Spinner animation="border" size="sm" className="ms-2" />}
            <Form.Select required value={draft.coachId} onChange={event => change('coachId', event.target.value)}><option value="">Chọn HLV trống lịch</option>{coaches.map(coach => <option key={coach.coachAccountId} value={coach.coachAccountId}>{coach.fullName}</option>)}</Form.Select>
            {!loading && !loadError && !coaches.length && <Form.Text>Không có HLV thay thế phù hợp ở khung giờ này.</Form.Text>}
          </Form.Group>}
          {!course && action !== 'reassign' && <Form.Group controlId="leave-session-reason"><Form.Label>Lý do *</Form.Label><Form.Control as="textarea" rows={3} required maxLength={1000} value={draft.reason} onChange={event => change('reason', event.target.value)} /></Form.Group>}
        </fieldset>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={onClose}>Quay lại</Button><Button variant={action === 'cancel' ? 'danger' : 'primary'} type="submit" disabled={busy || loading || Boolean(loadError) || (action === 'reassign' && !coaches.length)}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></Modal.Footer>
    </Form>
  </Modal>;
}
