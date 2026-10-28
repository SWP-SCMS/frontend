import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import {
  createCoachLeaveRequest,
  listMyCoachLeaveRequests,
  withdrawCoachLeaveRequest,
} from '../../../services/coachLeaveService';
import { formatDateTime } from '../../../utils';

const STATUS = {
  PENDING: ['Chờ duyệt', 'warning'],
  APPROVED: ['Đã duyệt', 'success'],
  REJECTED: ['Từ chối', 'danger'],
  WITHDRAWN: ['Đã rút', 'secondary'],
};

function localDateTimeMin() {
  const now = new Date(Date.now() + 60_000);
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function messageFor(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    COACH_LEAVE_OVERLAP: 'Khoảng nghỉ này bị trùng với một yêu cầu đang mở.',
    COACH_LEAVE_NOT_PENDING: 'Chỉ có thể rút yêu cầu đang chờ duyệt.',
    COACH_LEAVE_NOT_FOUND: 'Không tìm thấy yêu cầu nghỉ.',
    VALIDATION_ERROR: 'Thời gian hoặc lý do chưa hợp lệ.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

function StatusBadge({ value }) {
  const [label, variant] = STATUS[value] || [value || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

export default function CoachLeaveRequestsPage() {
  const [minimum] = useState(localDateTimeMin);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ startTime: '', endTime: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [withdrawRow, setWithdrawRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await listMyCoachLeaveRequests());
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshInBackground = useCallback(async () => {
    try {
      setRows(await listMyCoachLeaveRequests());
    } catch {
      // Keep the current request list visible if a background refresh fails.
    }
  }, []);
  useAutoRefresh(refreshInBackground, 30_000, !busy);

  async function submit(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);
    if (!form.startTime || !form.endTime || !form.reason.trim()) {
      setActionError(new Error('Vui lòng nhập đủ thời gian và lý do nghỉ.'));
      return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setActionError(new Error('Thời gian kết thúc phải sau thời gian bắt đầu.'));
      return;
    }
    setBusy(true);
    try {
      await createCoachLeaveRequest({
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        reason: form.reason.trim(),
      });
      setForm({ startTime: '', endTime: '', reason: '' });
      setNotice('Đã gửi yêu cầu nghỉ.');
      await load();
    } catch (error) {
      setActionError(new Error(messageFor(error, 'Không thể gửi yêu cầu nghỉ.')));
    } finally {
      setBusy(false);
    }
  }

  async function confirmWithdraw() {
    if (!withdrawRow) return;
    setBusy(true);
    setActionError(null);
    try {
      await withdrawCoachLeaveRequest(withdrawRow.id);
      setWithdrawRow(null);
      setNotice('Đã rút yêu cầu nghỉ.');
      await load();
    } catch (error) {
      setActionError(new Error(messageFor(error, 'Không thể rút yêu cầu nghỉ.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Yêu cầu nghỉ</h1>
          <p className="text-muted mb-0">Gửi khoảng thời gian nghỉ để quản lý xem xét và sắp xếp lịch phụ trách.</p>
        </div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
      </div>

      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {actionError ? <ErrorAlert error={actionError} title="Không thể xử lý yêu cầu" onClose={() => setActionError(null)} /> : null}
      {loadError ? <ErrorAlert error={loadError} title="Không tải được yêu cầu nghỉ" /> : null}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <h2 className="h5 fw-bold mb-3">Tạo yêu cầu nghỉ</h2>
          <Form onSubmit={submit} className="row g-3 align-items-end">
            <Form.Group className="col-lg-3">
              <Form.Label>Từ thời điểm *</Form.Label>
              <Form.Control type="datetime-local" min={minimum} value={form.startTime} onChange={(event) => setForm((value) => ({ ...value, startTime: event.target.value }))} />
            </Form.Group>
            <Form.Group className="col-lg-3">
              <Form.Label>Đến thời điểm *</Form.Label>
              <Form.Control type="datetime-local" min={form.startTime || minimum} value={form.endTime} onChange={(event) => setForm((value) => ({ ...value, endTime: event.target.value }))} />
            </Form.Group>
            <Form.Group className="col-lg-4">
              <Form.Label>Lý do *</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={1000} value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} />
            </Form.Group>
            <div className="col-lg-2">
              <Button type="submit" variant="danger" className="w-100" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi yêu cầu'}</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <h2 className="h5 fw-bold mb-3">Lịch sử yêu cầu</h2>
          {loading ? <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div> : !rows.length ? (
            <p className="text-muted mb-0">Chưa có yêu cầu nghỉ nào.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead><tr><th>Ngày gửi</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Phản hồi</th><th>Buổi bị ảnh hưởng</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{formatDateTime(row.startTime)}<br /><span className="text-muted">đến {formatDateTime(row.endTime)}</span></td>
                    <td style={{ minWidth: 180 }}>{row.reason}</td>
                    <td>{row.reviewNote || '—'}</td>
                    <td>{row.affectedSessionIds?.length || 0}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td className="text-end">{row.status === 'PENDING' ? <Button size="sm" variant="outline-danger" onClick={() => setWithdrawRow(row)}>Rút yêu cầu</Button> : '—'}</td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={Boolean(withdrawRow)} onHide={() => !busy && setWithdrawRow(null)} centered backdrop="static">
        <Modal.Header closeButton={!busy}><Modal.Title className="h5">Rút yêu cầu nghỉ</Modal.Title></Modal.Header>
        <Modal.Body>Bạn có chắc muốn rút yêu cầu nghỉ từ <strong>{withdrawRow ? formatDateTime(withdrawRow.startTime) : ''}</strong>?</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setWithdrawRow(null)} disabled={busy}>Quay lại</Button>
          <Button variant="danger" onClick={confirmWithdraw} disabled={busy}>{busy ? 'Đang xử lý...' : 'Xác nhận rút'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
