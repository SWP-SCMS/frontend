import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { DateInput } from '../../../components/common/DateInput';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import {
  createMyFreezeRequest,
  createMyTerminationRequest,
  endMyFreezeEarly,
  listMyFreezeRequests,
  listMyTerminationRequests,
  withdrawMyFreezeRequest,
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
  ACTIVE: ['Đang đóng băng', 'primary'],
  COMPLETED: ['Đã hoàn tất', 'secondary'],
  OBSOLETE: ['Không còn hiệu lực', 'secondary'],
  REJECTED: ['Bị từ chối', 'danger'],
  WITHDRAWN: ['Đã rút', 'secondary'],
};

const ERROR_MESSAGES = {
  MEMBERSHIP_NOT_ACTIVE: 'Bạn cần có gói tập đang hoạt động để gửi yêu cầu.',
  MEMBERSHIP_TERMINATION_ALREADY_PENDING: 'Bạn đã có một yêu cầu hủy gói đang chờ xử lý.',
  MEMBERSHIP_TERMINATION_INVALID_TRANSITION: 'Yêu cầu hủy gói không còn ở trạng thái có thể rút.',
  MEMBERSHIP_FREEZE_ALREADY_PENDING: 'Bạn đã có một yêu cầu đóng băng gói đang mở.',
  MEMBERSHIP_FREEZE_INVALID_PERIOD: 'Khoảng thời gian đóng băng không hợp lệ.',
  MEMBERSHIP_FREEZE_INVALID_TRANSITION: 'Yêu cầu đóng băng không còn ở trạng thái có thể xử lý.',
  MEMBERSHIP_FREEZE_CHANGED: 'Yêu cầu vừa được cập nhật. Vui lòng tải lại.',
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
  const {
    hasActiveMembership,
    loading: membershipLoading,
    error: membershipError,
  } = useMemberArea();
  const [terminationRows, setTerminationRows] = useState([]);
  const [freezeRows, setFreezeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [freezeAction, setFreezeAction] = useState(null);
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
      ['PENDING', 'APPROVED_PENDING_PAYMENT', 'SCHEDULED', 'ACTIVE'].includes(row.status)),
    [freezeRows],
  );
  const noActiveMembership =
    !membershipLoading && !membershipError && !hasActiveMembership;

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

  async function submitFreezeAction() {
    if (!freezeAction) return;
    const row = freezeAction.row;
    setBusyKey(row.id);
    setActionError(null);
    setNotice(null);
    try {
      if (freezeAction.action === 'withdraw') {
        await withdrawMyFreezeRequest(row.id);
        setNotice('Đã rút yêu cầu đóng băng gói tập.');
      } else {
        await endMyFreezeEarly(row.id, row.version);
        setNotice('Đã kết thúc thời gian đóng băng sớm.');
      }
      setFreezeAction(null);
      await load();
    } catch (error) {
      setActionError(new Error(messageOf(error, 'Không thể cập nhật yêu cầu đóng băng.')));
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
      {actionError && !noActiveMembership ? <ErrorAlert error={actionError} title="Không thể xử lý yêu cầu" /> : null}
      {loadError ? <ErrorAlert error={loadError} title="Không tải được danh sách yêu cầu" /> : null}

      {loading || membershipLoading ? (
        <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div>
      ) : (
        <div className="d-grid gap-4">
          {noActiveMembership ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4 text-center">
                <h2 className="h5 fw-bold mb-2">Bạn không có gói tập đang hoạt động</h2>
                <p className="text-muted mb-4">
                  Bạn cần có gói tập đang hoạt động để gửi yêu cầu hủy hoặc đóng băng.
                </p>
                <Button as={Link} to="/offers" variant="danger">
                  Xem các gói tập
                </Button>
              </Card.Body>
            </Card>
          ) : null}

          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">
                {noActiveMembership ? 'Lịch sử yêu cầu hủy gói' : 'Hủy gói tập'}
              </h2>
              {!noActiveMembership ? (
                <>
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
                </>
              ) : null}
              <RequestTable type="termination" rows={terminationRows} busyKey={busyKey} onWithdraw={setWithdrawTarget} />
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">
                {noActiveMembership ? 'Lịch sử yêu cầu đóng băng' : 'Đóng băng gói tập'}
              </h2>
              {!noActiveMembership ? (
                <>
                  <p className="text-muted small">
                    Sau khi quản lý duyệt, bạn cần thanh toán phí tại quầy lễ tân để lịch đóng băng có hiệu lực.
                  </p>
                  <Form onSubmit={submitFreeze} className="scms-membership-request-form">
                    <Form.Group>
                      <Form.Label>Từ ngày</Form.Label>
                      <DateInput
                        min={todayInput()}
                        value={freeze.startDate}
                        onChange={(startDate) => setFreeze((value) => ({ ...value, startDate }))}
                        disabled={hasOpenFreeze}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>Đến ngày</Form.Label>
                      <DateInput
                        min={freeze.startDate || todayInput()}
                        value={freeze.endDate}
                        onChange={(endDate) => setFreeze((value) => ({ ...value, endDate }))}
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
                </>
              ) : null}
              <RequestTable type="freeze" rows={freezeRows} busyKey={busyKey} onFreezeAction={setFreezeAction} />
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

      <Modal show={Boolean(freezeAction)} onHide={() => setFreezeAction(null)} centered backdrop="static">
        <Modal.Header closeButton={busyKey !== freezeAction?.row?.id}>
          <Modal.Title className="h5">
            {freezeAction?.action === 'withdraw' ? 'Rút yêu cầu đóng băng' : 'Kết thúc đóng băng sớm'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            {freezeAction?.action === 'withdraw'
              ? 'Bạn có chắc muốn rút yêu cầu đóng băng đang chờ duyệt?'
              : 'Bạn có chắc muốn kết thúc thời gian đóng băng ngay bây giờ?'}
          </p>
          <div className="small text-muted">
            {formatDate(freezeAction?.row?.startDate)} – {formatDate(freezeAction?.row?.endDate)}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={busyKey === freezeAction?.row?.id} onClick={() => setFreezeAction(null)}>Quay lại</Button>
          <Button variant="danger" disabled={busyKey === freezeAction?.row?.id} onClick={submitFreezeAction}>
            {busyKey === freezeAction?.row?.id ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function RequestTable({ type, rows, busyKey, onWithdraw, onFreezeAction }) {
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
            <th className="text-end">Thao tác</th>
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
              <td className="text-end">
                {termination ? (
                  row.status === 'PENDING' ? (
                    <Button size="sm" variant="outline-secondary" disabled={busyKey === row.id} onClick={() => onWithdraw(row)}>
                      {busyKey === row.id ? 'Đang rút...' : 'Rút yêu cầu'}
                    </Button>
                  ) : '—'
                ) : row.status === 'PENDING' ? (
                  <Button size="sm" variant="outline-secondary" disabled={busyKey === row.id} onClick={() => onFreezeAction({ action: 'withdraw', row })}>Rút yêu cầu</Button>
                ) : row.status === 'ACTIVE' ? (
                  <Button size="sm" variant="outline-danger" disabled={busyKey === row.id} onClick={() => onFreezeAction({ action: 'end-early', row })}>Kết thúc sớm</Button>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
