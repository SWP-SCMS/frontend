import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Modal,
  Spinner,
  Table,
} from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { ACCOUNT_STATUS, ROLES } from '../../constants';
import {
  assignCoach,
  endCoachAssignment,
  getActiveCoachAssignment,
  listCoachAssignmentHistory,
  listCoachAssignmentWorkloads,
} from '../../services/coachAssignmentService';
import { searchStaffAccounts } from '../../services/staffAccountService';
import { formatGymDate, formatGymTime } from '../../utils/gymTime';
import ErrorAlert from '../common/ErrorAlert';

const assignSchema = z.object({
  coachAccountId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
  reason: z.string().max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
});

const endSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập lý do kết thúc phân công.')
    .max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
});

const ERROR_MESSAGES = {
  MEMBER_NOT_ACTIVE: 'Chỉ có thể phân công HLV cho hội viên đang hoạt động.',
  COACH_NOT_FOUND: 'Không tìm thấy huấn luyện viên đã chọn.',
  COACH_NOT_ACTIVE: 'Huấn luyện viên đã chọn không còn hoạt động.',
  PLUS_MEMBERSHIP_REQUIRED:
    'Hội viên cần có gói tập còn hiệu lực với quyền huấn luyện viên cá nhân.',
  COACH_ALREADY_ASSIGNED: 'Hội viên đang được phân công cho chính huấn luyện viên này.',
  COACH_ASSIGNMENT_NOT_FOUND: 'Không còn phân công HLV đang hoạt động để kết thúc.',
  COACH_ASSIGNMENT_CONFLICT:
    'Trạng thái phân công vừa thay đổi. Vui lòng tải lại và thử lại.',
  COACH_CAPACITY_EXCEEDED:
    'Huấn luyện viên vừa đạt số hội viên tối đa. Vui lòng chọn HLV khác.',
};

function businessMessage(error) {
  return ERROR_MESSAGES[error?.response?.data?.code] || null;
}

function formatInstant(value) {
  if (!value) return '—';
  return `${formatGymDate(value)} · ${formatGymTime(value)}`;
}

export default function MemberCoachAssignmentCard({
  memberAccountId,
  memberStatus,
}) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachesError, setCoachesError] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const assignForm = useForm({
    resolver: zodResolver(assignSchema),
    defaultValues: { coachAccountId: '', reason: '' },
  });
  const endForm = useForm({
    resolver: zodResolver(endSchema),
    defaultValues: { reason: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [active, historyPage] = await Promise.all([
        getActiveCoachAssignment(memberAccountId),
        listCoachAssignmentHistory(memberAccountId, { page: 0, size: 10 }),
      ]);
      setCurrent(active);
      setHistory(historyPage?.content || []);
      setHistoryTotal(historyPage?.totalElements || 0);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [memberAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openAssignModal() {
    setActionError(null);
    setCoachesError(null);
    assignForm.reset({ coachAccountId: '', reason: '' });
    setShowAssign(true);
    if (coachesLoading) return;
    setCoachesLoading(true);
    try {
      const [page, workloads] = await Promise.all([
        searchStaffAccounts({
          role: ROLES.COACH,
          status: ACCOUNT_STATUS.ACTIVE,
          page: 0,
          size: 100,
        }),
        listCoachAssignmentWorkloads(),
      ]);
      const workloadById = new Map(workloads.map((item) => [item.coachAccountId, item]));
      setCoaches((page?.content || []).map((coach) => ({
        ...coach,
        workload: workloadById.get(coach.accountId) || null,
      })));
    } catch (error) {
      setCoachesError(error);
    } finally {
      setCoachesLoading(false);
    }
  }

  function openEndModal() {
    setActionError(null);
    endForm.reset({ reason: '' });
    setShowEnd(true);
  }

  async function submitAssignment(values) {
    setSubmitting(true);
    setActionError(null);
    try {
      await assignCoach(memberAccountId, {
        coachAccountId: values.coachAccountId,
        reason: values.reason.trim() || null,
      });
      setShowAssign(false);
      await load();
    } catch (error) {
      setActionError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEnd(values) {
    setSubmitting(true);
    setActionError(null);
    try {
      await endCoachAssignment(memberAccountId, {
        reason: values.reason.trim(),
      });
      setShowEnd(false);
      await load();
    } catch (error) {
      setActionError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const knownActionError = businessMessage(actionError);
  const canAssign = memberStatus === ACCOUNT_STATUS.ACTIVE;

  return (
    <>
      <Card className="border-0 shadow-sm mt-3">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h6 text-uppercase text-muted mb-1">
                Huấn luyện viên cá nhân
              </h2>
              <p className="small text-muted mb-0">
                Việc phân công yêu cầu hội viên đang hoạt động và có quyền huấn luyện viên cá nhân.
              </p>
            </div>
            {!loading && !loadError && canAssign ? (
              <Button type="button" variant="outline-danger" size="sm" onClick={openAssignModal}>
                {current ? 'Đổi HLV' : 'Phân công HLV'}
              </Button>
            ) : null}
          </div>

          {loading ? (
            <div className="py-3 text-center">
              <Spinner animation="border" size="sm" variant="danger" />
            </div>
          ) : null}
          {loadError ? (
            <ErrorAlert error={loadError} title="Không tải được thông tin phân công HLV" />
          ) : null}
          {!loading && !loadError && !canAssign ? (
            <Alert variant="warning" className="mt-3 mb-0">
              Hội viên không ở trạng thái hoạt động nên không thể gán hoặc đổi HLV.
            </Alert>
          ) : null}
          {!loading && !loadError && current ? (
            <div className="mt-3">
              <dl className="row mb-2">
                <dt className="col-sm-3 text-muted fw-normal">HLV hiện tại</dt>
                <dd className="col-sm-9 mb-2 fw-semibold">{current.coachFullName || '—'}</dd>
                <dt className="col-sm-3 text-muted fw-normal">Liên hệ</dt>
                <dd className="col-sm-9 mb-2">
                  {[current.coachPhone, current.coachEmail].filter(Boolean).join(' · ') || '—'}
                </dd>
                <dt className="col-sm-3 text-muted fw-normal">Bắt đầu</dt>
                <dd className="col-sm-9 mb-0">{formatInstant(current.startsAt)}</dd>
              </dl>
              <Button type="button" variant="outline-secondary" size="sm" onClick={openEndModal}>
                Kết thúc phân công
              </Button>
            </div>
          ) : null}
          {!loading && !loadError && !current ? (
            <p className="text-muted mt-3 mb-0">Hội viên chưa có HLV được phân công.</p>
          ) : null}

          {!loading && !loadError && history.length > 0 ? (
            <div className="mt-4">
              <h3 className="h6">Lịch sử phân công</h3>
              <div className="table-responsive">
                <Table size="sm" className="align-middle mb-1">
                  <thead>
                    <tr>
                      <th>Huấn luyện viên</th>
                      <th>Bắt đầu</th>
                      <th>Kết thúc</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>{item.coachFullName || item.coachAccountId}</td>
                        <td>{formatInstant(item.startsAt)}</td>
                        <td>
                          {formatInstant(item.endsAt)}
                          {item.endReason ? (
                            <div className="small text-muted">{item.endReason}</div>
                          ) : null}
                        </td>
                        <td>{item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã kết thúc'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {historyTotal > history.length ? (
                <div className="small text-muted">
                  Đang hiển thị {history.length}/{historyTotal} lần phân công gần nhất.
                </div>
              ) : null}
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Modal show={showAssign} onHide={() => !submitting && setShowAssign(false)} centered>
        <Form onSubmit={assignForm.handleSubmit(submitAssignment)} noValidate>
          <Modal.Header closeButton>
            <Modal.Title>{current ? 'Đổi huấn luyện viên' : 'Phân công huấn luyện viên'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {knownActionError ? <Alert variant="danger">{knownActionError}</Alert> : null}
            {!knownActionError ? (
              <ErrorAlert error={actionError} title="Không lưu được phân công HLV" />
            ) : null}
            <ErrorAlert error={coachesError} title="Không tải được danh sách HLV" />
            <Form.Group controlId="coach-assignment-coach">
              <Form.Label>Huấn luyện viên *</Form.Label>
              <Form.Select
                {...assignForm.register('coachAccountId')}
                disabled={coachesLoading || Boolean(coachesError)}
                isInvalid={Boolean(assignForm.formState.errors.coachAccountId)}
              >
                <option value="">
                  {coachesLoading ? 'Đang tải…' : '-- Chọn huấn luyện viên --'}
                </option>
                {coaches.map((coach) => (
                  <option
                    key={coach.accountId}
                    value={coach.accountId}
                    disabled={coach.workload?.availableForAssignment === false}
                  >
                    {coach.fullName} · {coach.phone || coach.email || coach.accountId}
                    {coach.workload ? ` · ${coach.workload.activeMemberCount}/${coach.workload.maximumMemberCount} hội viên${coach.workload.availableForAssignment ? '' : ' · Đã đầy'}` : ''}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {assignForm.formState.errors.coachAccountId?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group controlId="coach-assignment-reason" className="mt-3">
              <Form.Label>Lý do {current ? 'đổi HLV' : '(không bắt buộc)'}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                {...assignForm.register('reason')}
                isInvalid={Boolean(assignForm.formState.errors.reason)}
              />
              <Form.Control.Feedback type="invalid">
                {assignForm.formState.errors.reason?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowAssign(false)} disabled={submitting}>
              Đóng
            </Button>
            <Button type="submit" variant="danger" disabled={submitting || coachesLoading || Boolean(coachesError)}>
              {submitting ? 'Đang lưu…' : current ? 'Xác nhận đổi HLV' : 'Xác nhận phân công'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showEnd} onHide={() => !submitting && setShowEnd(false)} centered>
        <Form onSubmit={endForm.handleSubmit(submitEnd)} noValidate>
          <Modal.Header closeButton>
            <Modal.Title>Kết thúc phân công HLV</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {knownActionError ? <Alert variant="danger">{knownActionError}</Alert> : null}
            {!knownActionError ? (
              <ErrorAlert error={actionError} title="Không kết thúc được phân công" />
            ) : null}
            <p className="text-muted small">
              HLV hiện tại: <strong>{current?.coachFullName || '—'}</strong>
            </p>
            <Form.Group controlId="coach-assignment-end-reason">
              <Form.Label>Lý do *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                {...endForm.register('reason')}
                isInvalid={Boolean(endForm.formState.errors.reason)}
              />
              <Form.Control.Feedback type="invalid">
                {endForm.formState.errors.reason?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowEnd(false)} disabled={submitting}>
              Đóng
            </Button>
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? 'Đang xử lý…' : 'Xác nhận kết thúc'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
