import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  createMyFreezeRequest,
  createMyTerminationRequest,
  listMyFreezeRequests,
  listMyTerminationRequests,
  withdrawMyTerminationRequest,
} from '../../../services/membershipRequestService';
import { formatDate, formatPrice } from '../../../utils';
import './MembershipRequestsPage.css';

const TERMINATION_STATUS = {
  PENDING: ['Chờ duyệt', 'warning'],
  APPROVED: ['Đã duyệt', 'info'],
  EXECUTED: ['Đã chấm dứt', 'secondary'],
  REJECTED: ['Bị từ chối', 'danger'],
  WITHDRAWN: ['Đã rút', 'secondary'],
  OBSOLETE: ['Không còn hiệu lực', 'secondary'],
};

const FREEZE_STATUS = {
  PENDING: ['Chờ duyệt', 'warning'],
  APPROVED_PENDING_PAYMENT: ['Chờ thanh toán phí', 'info'],
  SCHEDULED: ['Đã lên lịch', 'success'],
  REJECTED: ['Bị từ chối', 'danger'],
};

const ERROR_MESSAGES = {
  MEMBERSHIP_NOT_ACTIVE: 'Bạn cần có gói tập đang hoạt động để gửi yêu cầu.',
  MEMBERSHIP_TERMINATION_ALREADY_PENDING: 'Bạn đã có một yêu cầu hủy gói đang chờ xử lý.',
  MEMBERSHIP_TERMINATION_INVALID_TRANSITION: 'Yêu cầu hủy gói không còn ở trạng thái có thể rút.',
  MEMBERSHIP_FREEZE_ALREADY_PENDING: 'Bạn đã có một yêu cầu đóng băng gói đang mở.',
  MEMBERSHIP_FREEZE_INVALID_PERIOD: 'Khoảng thời gian đóng băng không hợp lệ.',
};

function messageOf(error, fallback) {
  const problem = error?.response?.data;
  return ERROR_MESSAGES[problem?.code] || problem?.detail || fallback;
}

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function StatusBadge({ status, map }) {
  const [label, variant] = map[status] || [status || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

export default function MembershipRequestsPage() {
  const [terminationRows, setTerminationRows] = useState([]);
  const [freezeRows, setFreezeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [termination, setTermination] = useState({ mode: 'END_OF_CYCLE', reason: '' });
  const [freeze, setFreeze] = useState({ startDate: '', endDate: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [terminationPage, freezePage] = await Promise.all([
        listMyTerminationRequests(),
        listMyFreezeRequests(),
      ]);
      setTerminationRows(terminationPage.content || []);
      setFreezeRows(freezePage.content || []);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasOpenTermination = useMemo(
    () => terminationRows.some((row) => row.status === 'PENDING'),
    [terminationRows],
  );
  const hasOpenFreeze = useMemo(
    () => freezeRows.some((row) =>
      ['PENDING', 'APPROVED_PENDING_PAYMENT', 'SCHEDULED'].includes(row.status)),
    [freezeRows],
  );

  async function submitTermination(event) {
    event.preventDefault();
    const reason = termination.reason.trim();
    if (!reason) {
      setActionError(new Error('Vui lòng nhập lý do hủy gói.'));
      return;
    }
    setBusyKey('termination-create');
    setActionError(null);
    setNotice(null);
    try {
      await createMyTerminationRequest({ mode: termination.mode, reason });
      setTermination({ mode: 'END_OF_CYCLE', reason: '' });
      setNotice('Đã gửi yêu cầu hủy gói tới quản lý.');
      await load();
    } catch (error) {
      setActionError(new Error(messageOf(error, 'Không thể gửi yêu cầu hủy gói.')));
    } finally {
      setBusyKey(null);
    }
  }

  async function withdrawTermination() {
    const row = withdrawTarget;
    if (!row) return;
    setBusyKey(row.id);
    setActionError(null);
    setNotice(null);
    try {
      await withdrawMyTerminationRequest(row.id);
      setWithdrawTarget(null);
      setNotice('Đã rút yêu cầu hủy gói.');
      await load();
    } catch (error) {
      setActionError(new Error(messageOf(error, 'Không thể rút yêu cầu hủy gói.')));
    } finally {
      setBusyKey(null);
    }
  }

  async function submitFreeze(event) {
    event.preventDefault();
    const reason = freeze.reason.trim();
    if (!freeze.startDate || !freeze.endDate || freeze.endDate <= freeze.startDate) {
      setActionError(new Error('Ngày kết thúc phải sau ngày bắt đầu.'));
      return;
    }
    if (!reason) {
      setActionError(new Error('Vui lòng nhập lý do đóng băng gói.'));
      return;
    }
    setBusyKey('freeze-create');
    setActionError(null);
    setNotice(null);
    try {
      await createMyFreezeRequest({ ...freeze, reason });
      setFreeze({ startDate: '', endDate: '', reason: '' });
      setNotice('Đã gửi yêu cầu đóng băng gói tới quản lý.');
      await load();
    } catch (error) {
      setActionError(new Error(messageOf(error, 'Không thể gửi yêu cầu đóng băng gói.')));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="scms-membership-requests">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link to="/member/plan" className="small text-decoration-none">← Quay lại gói tập</Link>
          <h1 className="h3 fw-bold mt-2 mb-1">Yêu cầu về gói tập</h1>
          <p className="text-muted mb-0">Gửi và theo dõi yêu cầu hủy hoặc đóng băng gói đang hoạt động.</p>
        </div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
      </div>

      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {actionError ? <ErrorAlert error={actionError} title="Không thể xử lý yêu cầu" /> : null}
      {loadError ? <ErrorAlert error={loadError} title="Không tải được danh sách yêu cầu" /> : null}

      {loading ? (
        <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div>
      ) : (
        <div className="d-grid gap-4">
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">Hủy gói tập</h2>
              <p className="text-muted small">
                Chọn hủy ngay hoặc tiếp tục dùng đến hết chu kỳ hiện tại. Yêu cầu chỉ có hiệu lực sau khi quản lý duyệt.
              </p>
              <Form onSubmit={submitTermination} className="scms-membership-request-form">
                <Form.Group>
                  <Form.Label>Thời điểm hủy</Form.Label>
                  <Form.Select
                    value={termination.mode}
                    onChange={(event) => setTermination((value) => ({ ...value, mode: event.target.value }))}
                    disabled={hasOpenTermination}
                  >
                    <option value="END_OF_CYCLE">Cuối chu kỳ hiện tại</option>
                    <option value="IMMEDIATE">Ngay sau khi được duyệt</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="scms-membership-request-reason">
                  <Form.Label>Lý do</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    maxLength={1000}
                    value={termination.reason}
                    onChange={(event) => setTermination((value) => ({ ...value, reason: event.target.value }))}
                    disabled={hasOpenTermination}
                  />
                </Form.Group>
                <Button type="submit" variant="danger" disabled={hasOpenTermination || busyKey === 'termination-create'}>
                  {hasOpenTermination ? 'Đang có yêu cầu chờ duyệt' : busyKey === 'termination-create' ? 'Đang gửi...' : 'Gửi yêu cầu hủy'}
                </Button>
              </Form>
              <RequestTable type="termination" rows={terminationRows} busyKey={busyKey} onWithdraw={setWithdrawTarget} />
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">Đóng băng gói tập</h2>
              <p className="text-muted small">
                Sau khi quản lý duyệt, bạn cần thanh toán phí tại quầy lễ tân để lịch đóng băng có hiệu lực.
              </p>
              <Form onSubmit={submitFreeze} className="scms-membership-request-form">
                <Form.Group>
                  <Form.Label>Từ ngày</Form.Label>
                  <Form.Control
                    type="date"
                    min={todayInput()}
                    value={freeze.startDate}
                    onChange={(event) => setFreeze((value) => ({ ...value, startDate: event.target.value }))}
                    disabled={hasOpenFreeze}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Đến ngày</Form.Label>
                  <Form.Control
                    type="date"
                    min={freeze.startDate || todayInput()}
                    value={freeze.endDate}
                    onChange={(event) => setFreeze((value) => ({ ...value, endDate: event.target.value }))}
                    disabled={hasOpenFreeze}
                  />
                </Form.Group>
                <Form.Group className="scms-membership-request-reason">
                  <Form.Label>Lý do</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    maxLength={1000}
                    value={freeze.reason}
                    onChange={(event) => setFreeze((value) => ({ ...value, reason: event.target.value }))}
                    disabled={hasOpenFreeze}
                  />
                </Form.Group>
                <Button type="submit" variant="danger" disabled={hasOpenFreeze || busyKey === 'freeze-create'}>
                  {hasOpenFreeze ? 'Đang có yêu cầu mở' : busyKey === 'freeze-create' ? 'Đang gửi...' : 'Gửi yêu cầu đóng băng'}
                </Button>
              </Form>
              <RequestTable type="freeze" rows={freezeRows} busyKey={busyKey} />
            </Card.Body>
          </Card>
        </div>
      )}

      <Modal
        show={Boolean(withdrawTarget)}
        onHide={() => setWithdrawTarget(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={busyKey !== withdrawTarget?.id}>
          <Modal.Title className="h5">Rút yêu cầu hủy gói</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Bạn có chắc muốn rút yêu cầu hủy gói này không?</p>
          <dl className="row small mb-0">
            <dt className="col-sm-4">Hình thức</dt>
            <dd className="col-sm-8">
              {withdrawTarget?.mode === 'IMMEDIATE' ? 'Hủy ngay' : 'Cuối chu kỳ hiện tại'}
            </dd>
            <dt className="col-sm-4">Lý do đã gửi</dt>
            <dd className="col-sm-8 mb-0">{withdrawTarget?.reason || '—'}</dd>
          </dl>
          <Alert variant="secondary" className="small mt-3 mb-0">
            Sau khi rút, gói tập vẫn hoạt động bình thường và bạn có thể gửi yêu cầu mới nếu cần.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="outline-secondary"
            disabled={busyKey === withdrawTarget?.id}
            onClick={() => setWithdrawTarget(null)}
          >
            Giữ yêu cầu
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busyKey === withdrawTarget?.id}
            onClick={withdrawTermination}
          >
            {busyKey === withdrawTarget?.id ? 'Đang rút...' : 'Xác nhận rút yêu cầu'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function RequestTable({ type, rows, busyKey, onWithdraw }) {
  if (!rows.length) return <p className="text-muted small mt-4 mb-0">Chưa có yêu cầu nào.</p>;
  const termination = type === 'termination';
  return (
    <div className="table-responsive mt-4">
      <Table hover className="align-middle mb-0">
        <thead>
          <tr>
            <th>Ngày gửi</th>
            <th>{termination ? 'Hình thức' : 'Thời gian'}</th>
            <th>Lý do</th>
            {!termination ? <th>Phí</th> : null}
            <th>Trạng thái</th>
            {termination ? <th className="text-end">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                {termination
                  ? row.mode === 'IMMEDIATE' ? 'Hủy ngay' : 'Cuối chu kỳ'
                  : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`}
              </td>
              <td className="scms-membership-request-reason-cell">{row.reason}</td>
              {!termination ? <td>{row.feeAmount == null ? 'Chưa xác định' : formatPrice(row.feeAmount, 'VND')}</td> : null}
              <td><StatusBadge status={row.status} map={termination ? TERMINATION_STATUS : FREEZE_STATUS} /></td>
              {termination ? (
                <td className="text-end">
                  {row.status === 'PENDING' ? (
                    <Button size="sm" variant="outline-secondary" disabled={busyKey === row.id} onClick={() => onWithdraw(row)}>
                      {busyKey === row.id ? 'Đang rút...' : 'Rút yêu cầu'}
                    </Button>
                  ) : '—'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
