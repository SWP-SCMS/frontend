import { Fragment, useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Modal, Nav, Spinner, Table } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { getCoachLeaveImpact, reviewCoachLeaveRequest } from '../../../services/coachLeaveService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import LeaveSessionActionModal from './LeaveSessionActionModal';
import LeaveBatchActionModal from './LeaveBatchActionModal';
import { sessionKey } from './leaveSessionSelection';

const statusLabels = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', WITHDRAWN: 'Đã rút', CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn' };
const types = { CLASS: 'Buổi lớp thường', PT: 'Buổi PT', COURSE: 'Buổi thuộc khóa học' };
function when(value) { return `${formatGymDate(value)} ${formatGymTime(value)}`; }

export default function CoachLeaveImpactPage() {
  const { requestId } = useParams();
  return <ImpactPage key={requestId} requestId={requestId} />;
}

function ImpactPage({ requestId }) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [batch, setBatch] = useState(null);
  const [tab, setTab] = useState('CLASS');
  const [selected, setSelected] = useState([]);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [decisionError, setDecisionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    try { commitValue(setImpact, await getCoachLeaveImpact(requestId)); commitError(setError, null); }
    catch (err) { failed(err); commitError(setError, err); }
    finally { if (!background) commitValue(setLoading, false); }
  }, [requestId]);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(load({ background, commitValue, commitError, failed }));
  }, [load], !editor && !batch && !decision && !busy);

  const request = impact?.request;
  const sessions = impact?.sessions || [];
  const remaining = Math.max(sessions.length, request?.affectedSessionIds?.length || 0);
  const pending = request?.status === 'PENDING';
  const canApprove = pending && remaining === 0 && !loading && !error;

  const visible = sessions.filter(session => session.type === tab);
  const chosen = visible.filter(session => selected.includes(sessionKey(session)));
  const selectable = visible.filter(session => session.canReassign || (session.canCancel && !session.memberCount));
  const empty = selectable.filter(session => session.canCancel && !session.memberCount);
  const allSelected = selectable.length > 0 && selectable.every(session => selected.includes(sessionKey(session)));
  const canBatchReassign = chosen.length > 0 && chosen.every(session => session.canReassign);
  const canBatchCancel = chosen.length > 0 && chosen.every(session => session.canCancel && !session.memberCount);
  const groups = tab === 'COURSE' ? Array.from(visible.reduce((map, session) => {
    if (!map.has(session.courseRunId)) map.set(session.courseRunId, []);
    map.get(session.courseRunId).push(session); return map;
  }, new Map()).values()) : [visible];
  const selectionDisabled = !pending || loading || !!error;
  function toggle(session) {
    const key = sessionKey(session);
    setSelected(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }

  async function submitDecision() {
    if (lock.current || !decision || (decision === 'approve' && !canApprove)) return;
    lock.current = true; setBusy(true); setDecisionError(null);
    try {
      await reviewCoachLeaveRequest(requestId, decision, note);
      setNotice(decision === 'approve' ? 'Đã duyệt yêu cầu nghỉ.' : 'Đã từ chối yêu cầu nghỉ.');
      setDecision(null); setNote('');
      await load();
    } catch (err) {
      setDecisionError(err?.response?.data?.code === 'COACH_LEAVE_HAS_AFFECTED_SESSIONS'
        ? new Error('Vừa phát sinh hoặc thay đổi buổi bị ảnh hưởng. Danh sách đã được tải lại; xử lý hết các buổi còn lại trước khi duyệt.') : err);
      await load();
    } finally { lock.current = false; setBusy(false); }
  }

  function openDecision(action) { setDecision(action); setDecisionError(null); setNote(''); }

  return <div>
    <WorkflowBreadcrumb items={[{ to: '/manager/coach-leave-requests', label: 'Duyệt nghỉ HLV' }]} current="Xử lý buổi bị ảnh hưởng" />
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 my-3">
      <h1 className="h3 fw-bold mb-0">Xử lý yêu cầu nghỉ</h1>
      <Button variant="outline-secondary" disabled={loading || busy} onClick={() => load()}>Tải lại</Button>
    </div>
    {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
    <ErrorAlert error={error} title="Không tải được các buổi bị ảnh hưởng" />
    {loading && !impact ? <Spinner animation="border" /> : request ? <>
      <Card className="border-0 shadow-sm mb-4"><Card.Body>
        <h2 className="h5">{request.coachFullName}</h2>
        <p className="mb-1">Nghỉ từ <strong>{when(request.startTime)}</strong> đến <strong>{when(request.endTime)}</strong> (giờ Việt Nam)</p>
        <p className="mb-1">Lý do: {request.reason}</p>
        <p className="mb-0">Trạng thái: <strong>{statusLabels[request.status] || request.status}</strong></p>
      </Card.Body></Card>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="h5 mb-0">Còn {remaining} buổi cần xử lý</h2>
        {pending && <div className="d-flex gap-2">
          <Button variant="success" disabled={!canApprove} onClick={() => openDecision('approve')}>Duyệt nghỉ</Button>
          <Button variant="outline-danger" disabled={busy || loading || !!error} onClick={() => openDecision('reject')}>Từ chối</Button>
        </div>}
      </div>
      {pending && !remaining && !error && <Alert variant="success">Không còn buổi nào trùng lịch nghỉ của HLV. Bạn có thể duyệt yêu cầu.</Alert>}
      {!pending && <Alert variant="secondary">Yêu cầu {statusLabels[request.status]?.toLocaleLowerCase('vi-VN') || request.status}. Không thể tiếp tục xử lý từ đơn này.</Alert>}
      <Card className="border-0 shadow-sm"><Card.Body>
        <Nav variant="tabs" role="tablist" aria-label="Loại buổi bị ảnh hưởng" className="scms-request-tabs mb-3">
          {Object.entries(types).map(([type, label]) => <Nav.Item key={type}><Nav.Link as="button" type="button" role="tab" aria-selected={tab === type} active={tab === type} onClick={() => { setTab(type); setSelected([]); }}>{label} ({sessions.filter(session => session.type === type).length})</Nav.Link></Nav.Item>)}
        </Nav>
        <p className="text-muted small">{tab === 'COURSE' ? 'Mỗi dòng là một buổi học thuộc đợt mở khóa, không phải toàn bộ khóa học.' : tab === 'PT' ? 'Các buổi huấn luyện cá nhân 1-1 bị ảnh hưởng.' : 'Các buổi lớp thường bị ảnh hưởng, không thuộc đợt mở khóa học.'}</p>
        {pending && <div className="d-flex flex-wrap align-items-center gap-2 mb-3 p-3 bg-light rounded">
          <strong className="me-2">Đã chọn {chosen.length} buổi</strong>
          <Button size="sm" variant="outline-secondary" disabled={selectionDisabled || !empty.length} onClick={() => setSelected(empty.map(sessionKey))}>Chọn buổi có thể hủy ({empty.length})</Button>
          <Button size="sm" variant="outline-secondary" disabled={!chosen.length} onClick={() => setSelected([])}>Bỏ chọn</Button>
          <Button size="sm" disabled={selectionDisabled || !canBatchReassign} onClick={() => setBatch({ sessions: chosen, action: 'reassign' })}>Đổi HLV đã chọn</Button>
          <Button size="sm" variant="outline-danger" disabled={selectionDisabled || !canBatchCancel} onClick={() => setBatch({ sessions: chosen, action: 'cancel' })}>Hủy buổi đã chọn</Button>
          {chosen.some(session => session.memberCount > 0) && <span className="small text-muted w-100">Có buổi đã có hội viên: chỉ được đổi HLV. Để hủy, chọn riêng các buổi chưa có hội viên.</span>}
        </div>}
        <Table responsive hover className="align-middle mb-0" style={{ minWidth: 820 }}>
          <thead><tr><th><Form.Check aria-label="Chọn tất cả trong tab" checked={allSelected} disabled={selectionDisabled || !selectable.length} onChange={() => setSelected(allSelected ? [] : selectable.map(sessionKey))} /></th><th>Buổi tập</th><th>Ngày giờ</th><th>Phòng</th><th>Hội viên</th><th>Thao tác</th></tr></thead>
          <tbody>{groups.map((group, index) => <Fragment key={group[0]?.courseRunId || index}>
            {tab === 'COURSE' && group.length > 0 && <tr className="table-light"><th colSpan={6}>Đợt {group[0].runCode} · {group[0].name} <span className="fw-normal">— {group.length} buổi bị ảnh hưởng</span></th></tr>}
            {group.map(session => <tr key={sessionKey(session)}>
              <td><Form.Check aria-label={`Chọn buổi ${session.name} ${session.id}`} checked={selected.includes(sessionKey(session))} disabled={selectionDisabled || (!session.canReassign && (!session.canCancel || session.memberCount > 0))} onChange={() => toggle(session)} /></td>
              <td><strong>{tab === 'COURSE' ? `Buổi ${session.unitNumber}` : session.name}</strong>{tab === 'COURSE' && <div className="small text-muted">{session.runCode}</div>}</td>
              <td>{formatGymDate(session.startTime)}<br /><span className="text-muted">{formatGymTime(session.startTime)}–{formatGymTime(session.endTime)}</span></td>
              <td>{session.roomName || 'Chưa phân phòng'}</td><td>{session.memberCount} / {session.capacity}</td>
              <td><div className="d-flex flex-wrap gap-2">
                <Button size="sm" variant="outline-primary" disabled={!pending || !session.canReassign || !!error || loading} onClick={() => setEditor({ session, action: 'reassign' })}>Đổi HLV</Button>
                <Button size="sm" variant="outline-danger" disabled={!pending || !session.canCancel || session.memberCount > 0 || !!error || loading} onClick={() => setEditor({ session, action: 'cancel' })}>Hủy buổi</Button>
                {session.memberCount > 0 && <span className="small text-muted w-100">Đã có hội viên đăng ký, không được hủy. Vui lòng đổi HLV.</span>}
              </div></td>
            </tr>)}
          </Fragment>)}{!visible.length && <tr><td colSpan={6} className="text-center text-muted py-4">Không có buổi bị ảnh hưởng trong nhóm này.</td></tr>}</tbody>
        </Table>
      </Card.Body></Card>
    </> : null}
    {batch && <LeaveBatchActionModal request={request} sessions={batch.sessions} action={batch.action} onClose={() => { setBatch(null); setSelected([]); load(); }} />}
    {editor && <LeaveSessionActionModal request={request} session={editor.session} action={editor.action} onClose={() => { setEditor(null); load(); }} onSaved={() => {
      setEditor(null); setNotice('Đã xử lý buổi tập. Danh sách còn lại được cập nhật; đơn nghỉ chưa được duyệt.'); load();
    }} />}
    <Modal show={!!decision} onHide={() => !busy && setDecision(null)} centered backdrop="static">
      <Modal.Header closeButton={!busy}><Modal.Title className="h5">{decision === 'approve' ? 'Duyệt nghỉ' : 'Từ chối yêu cầu nghỉ'}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p>Xác nhận {decision === 'approve' ? 'duyệt nghỉ' : 'từ chối'} cho {request?.coachFullName}?</p>
        <ErrorAlert error={decisionError} title="Không xử lý được yêu cầu" />
        {decision === 'approve' && remaining > 0 && <Alert variant="warning">Còn {remaining} buổi cần xử lý.</Alert>}
        <Form.Group controlId="leave-review-note"><Form.Label>Ghi chú phản hồi</Form.Label><Form.Control as="textarea" rows={3} maxLength={1000} disabled={busy} value={note} onChange={event => setNote(event.target.value)} /></Form.Group>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setDecision(null)}>Quay lại</Button><Button variant={decision === 'approve' ? 'success' : 'danger'} disabled={busy || !pending || (decision === 'approve' && !canApprove)} onClick={submitDecision}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></Modal.Footer>
    </Modal>
    <Link className="d-inline-block mt-3" to="/manager/coach-leave-requests">← Quay lại danh sách yêu cầu</Link>
  </div>;
}
