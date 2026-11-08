import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { getLeaveBatchReplacementCoaches, resolveLeaveBatch } from '../../../services/coachLeaveService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import ErrorAlert from '../../../components/common/ErrorAlert';

import { sessionKey, sessionsOverlap } from './leaveSessionSelection';

export default function LeaveBatchActionModal({ request, sessions, action, onClose }) {
  const [coaches, setCoaches] = useState([]);
  const [coachId, setCoachId] = useState('');
  const [reason, setReason] = useState(`HLV ${request.coachFullName} xin nghỉ: ${request.reason}`.slice(0, 1000));
  const [loading, setLoading] = useState(action === 'reassign');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const lock = useRef(false);
  const overlap = action === 'reassign' && sessionsOverlap(sessions);

  useEffect(() => {
    if (action !== 'reassign' || overlap) { setLoading(false); return undefined; }
    let active = true;
    getLeaveBatchReplacementCoaches(request.id, sessions)
      .then(value => { if (active) setCoaches(value); })
      .catch(err => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.id, sessions, action, overlap]);

  async function submit(event) {
    event.preventDefault();
    if (lock.current || results || overlap || loading || (action === 'reassign' && !coachId)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await resolveLeaveBatch(request.id, sessions, action, coachId, reason);
      setResults({ success: true, count: result.processedCount });
    } catch (err) {
      setResults({ success: false, uncertain: !err?.response || err.response.status >= 500 });
      const messages = {
        COACH_LEAVE_BATCH_CHANGED: 'Danh sách đã thay đổi hoặc có buổi không còn đủ điều kiện. Chưa cập nhật buổi nào; hãy tải lại.',
        COACH_LEAVE_NOT_PENDING: 'Đơn nghỉ không còn chờ duyệt. Hãy tải lại danh sách.',
        COACH_LEAVE_BATCH_OVERLAP: 'Các buổi đã chọn trùng giờ nhau. Hãy chia nhóm nhỏ hơn.',
      };
      setError(messages[err?.response?.data?.code] ? new Error(messages[err.response.data.code]) : err);
    } finally { lock.current = false; setBusy(false); }
  }

  return <Modal show centered size="lg" backdrop="static" keyboard={!busy} onHide={() => !busy && onClose()}>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!busy}><Modal.Title className="h5">{action === 'cancel' ? 'Hủy' : 'Đổi HLV cho'} {sessions.length} buổi đã chọn</Modal.Title></Modal.Header>
      <Modal.Body>
        <p>{action === 'cancel' ? 'Chỉ hủy các buổi chưa có hội viên đăng ký. Kiểm tra danh sách trước khi xác nhận.' : 'Giữ nguyên ngày giờ và phòng. Chỉ hiển thị HLV phù hợp với tất cả buổi đã chọn.'}</p>
        {overlap && <Alert variant="warning">Các buổi đã chọn trùng giờ nhau, một HLV không thể phụ trách tất cả. Hãy chia thành nhóm nhỏ hơn.</Alert>}
        <ErrorAlert error={error} title="Không thể hoàn tất xử lý" />
        {results && <Alert variant={results.success ? 'success' : 'warning'}>{results.success
          ? `Đã xử lý toàn bộ ${results.count} buổi. Đơn nghỉ chưa được duyệt tự động.`
          : results.uncertain ? 'Chưa xác nhận được kết quả. Đóng cửa sổ và tải lại danh sách trước khi thử tiếp.'
            : 'Không cập nhật buổi nào. Đóng cửa sổ để tải lại danh sách và xử lý nguyên nhân lỗi.'}</Alert>}
        <div style={{ maxHeight: '38vh', overflow: 'auto' }}>
          <Table size="sm" responsive style={{ minWidth: 540 }}><thead><tr><th>Buổi</th><th>Ngày giờ</th><th>Hội viên</th></tr></thead>
            <tbody>{sessions.map(session => <tr key={sessionKey(session)}>
              <td>{session.name}{session.type === 'COURSE' && <div className="small text-muted">{session.runCode} · Buổi {session.unitNumber}</div>}</td>
              <td>{formatGymDate(session.startTime)} · {formatGymTime(session.startTime)}–{formatGymTime(session.endTime)}</td>
              <td>{session.memberCount}</td>
            </tr>)}</tbody>
          </Table>
        </div>
        {!results && <fieldset disabled={busy || loading || overlap}>
          {action === 'reassign' ? <Form.Group controlId="batch-replacement-coach">
            <Form.Label>HLV thay thế cho tất cả buổi *</Form.Label>
            {loading && <Spinner size="sm" animation="border" className="ms-2" />}
            <Form.Select required value={coachId} onChange={event => setCoachId(event.target.value)}>
              <option value="">Chọn HLV</option>{coaches.map(coach => <option key={coach.coachAccountId} value={coach.coachAccountId}>{coach.fullName}</option>)}
            </Form.Select>
            {!loading && !error && !overlap && !coaches.length && <Form.Text>Không có HLV phù hợp với toàn bộ các buổi. Hãy chọn ít buổi hơn hoặc đổi từng buổi.</Form.Text>}
          </Form.Group> : <Form.Group controlId="batch-cancel-reason"><Form.Label>Lý do hủy *</Form.Label><Form.Control as="textarea" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></Form.Group>}
        </fieldset>}
        {busy && <p className="mt-3 mb-0" role="status">Đang xử lý toàn bộ {sessions.length} buổi…</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={busy} onClick={onClose}>{results ? 'Đóng và tải lại' : 'Quay lại'}</Button>
        {!results && <Button type="submit" variant={action === 'cancel' ? 'danger' : 'primary'} disabled={busy || loading || overlap || !!error || (action === 'reassign' && !coachId)}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button>}
      </Modal.Footer>
    </Form>
  </Modal>;
}
