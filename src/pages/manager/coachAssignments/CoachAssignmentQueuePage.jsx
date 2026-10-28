// Manager – PERSONAL_COACHING assignment discovery workflow.
//
// The candidate endpoint is the eligibility source of truth: every returned
// Member is ACTIVE and has an ACTIVE Membership with PERSONAL_COACHING. Coach
// workload exposes the same capacity rule enforced by the backend. The UI
// disables full Coaches for early feedback; the mutation remains authoritative.

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import {
  ASSIGNMENT_CANDIDATE_STATUS,
  assignCoach,
  getActiveCoachAssignment,
  listCoachAssignmentCandidates,
  listCoachAssignmentHistory,
  listCoachAssignmentWorkloads,
} from '../../../services/coachAssignmentService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const PAGE_SIZE = 20;

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

const STATUS_FILTERS = [
  { value: ASSIGNMENT_CANDIDATE_STATUS.UNASSIGNED, label: 'Chưa có HLV' },
  { value: ASSIGNMENT_CANDIDATE_STATUS.ASSIGNED, label: 'Đã có HLV' },
  { value: ASSIGNMENT_CANDIDATE_STATUS.ALL, label: 'Tất cả' },
];

const assignSchema = z.object({
  coachAccountId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
  reason: z.string().max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
});

const ERROR_MESSAGES = {
  MEMBERSHIP_FROZEN: 'Gói tập của hội viên đang được đóng băng nên chưa thể phân công huấn luyện viên.',
  MEMBER_NOT_FOUND: 'Không tìm thấy hội viên cần phân công.',
  MEMBER_NOT_ACTIVE: 'Hội viên không còn ở trạng thái hoạt động.',
  COACH_NOT_FOUND: 'Không tìm thấy huấn luyện viên đã chọn.',
  COACH_NOT_ACTIVE: 'Huấn luyện viên đã chọn không còn hoạt động.',
  PLUS_MEMBERSHIP_REQUIRED:
    'Hội viên không còn gói tập hiệu lực với quyền huấn luyện viên cá nhân.',
  COACH_ALREADY_ASSIGNED: 'Hội viên đang được phân công cho chính HLV này.',
  COACH_ASSIGNMENT_CONFLICT:
    'Phân công vừa thay đổi ở nơi khác. Danh sách sẽ được tải lại.',
  COACH_CAPACITY_EXCEEDED:
    'Huấn luyện viên vừa đạt số hội viên tối đa. Vui lòng chọn HLV khác.',
};

function formatInstant(value) {
  if (!value) return '—';
  return `${formatGymDate(value)} · ${formatGymTime(value)}`;
}

function numberParam(params, name, fallback) {
  const value = Number(params.get(name));
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function statusParam(params) {
  const value = params.get('assignmentStatus');
  return Object.values(ASSIGNMENT_CANDIDATE_STATUS).includes(value)
    ? value
    : ASSIGNMENT_CANDIDATE_STATUS.UNASSIGNED;
}

function businessMessage(error) {
  return ERROR_MESSAGES[error?.response?.data?.code] || null;
}

export default function CoachAssignmentQueuePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('query') || '';
  const assignmentStatus = statusParam(params);
  const page = numberParam(params, 'page', 0);

  const [candidates, setCandidates] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(query);
  const [workloads, setWorkloads] = useState([]);
  const [workloadsLoading, setWorkloadsLoading] = useState(true);
  const [workloadsError, setWorkloadsError] = useState(null);
  const [notice, setNotice] = useState('');

  const [assignMember, setAssignMember] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentError, setCurrentError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [historyMember, setHistoryMember] = useState(null);
  const [historyCurrent, setHistoryCurrent] = useState(null);
  const [historyPage, setHistoryPage] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const assignForm = useForm({
    resolver: zodResolver(assignSchema),
    defaultValues: { coachAccountId: '', reason: '' },
  });

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCoachAssignmentCandidates({
        query: query || undefined,
        assignmentStatus,
        page,
        size: PAGE_SIZE,
      });
      setCandidates({ ...EMPTY_PAGE, ...data });
    } catch (loadError) {
      setError(loadError);
      setCandidates(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [assignmentStatus, page, query]);

  const loadWorkloads = useCallback(async () => {
    setWorkloadsLoading(true);
    setWorkloadsError(null);
    try {
      const data = await listCoachAssignmentWorkloads();
      setWorkloads(
        [...data].sort(
          (left, right) =>
            Number(left.activeMemberCount || 0) - Number(right.activeMemberCount || 0)
            || String(left.fullName || '').localeCompare(String(right.fullName || ''), 'vi'),
        ),
      );
    } catch (loadError) {
      setWorkloadsError(loadError);
      setWorkloads([]);
    } finally {
      setWorkloadsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    loadWorkloads();
  }, [loadWorkloads]);

  const refreshInBackground = useCallback(async () => {
    try {
      const [data, workloadData] = await Promise.all([
        listCoachAssignmentCandidates({
          query: query || undefined,
          assignmentStatus,
          page,
          size: PAGE_SIZE,
        }),
        listCoachAssignmentWorkloads(),
      ]);
      setCandidates({ ...EMPTY_PAGE, ...data });
      setWorkloads(
        [...workloadData].sort(
          (left, right) =>
            Number(left.activeMemberCount || 0) - Number(right.activeMemberCount || 0)
            || String(left.fullName || '').localeCompare(String(right.fullName || ''), 'vi'),
        ),
      );
    } catch {
      // Keep the visible candidate and workload data on transient failures.
    }
  }, [assignmentStatus, page, query]);
  useAutoRefresh(refreshInBackground, 30_000, !assignMember && !historyMember && !submitting);

  function setParam(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  function submitSearch(event) {
    event.preventDefault();
    setParam('query', searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setParam('query', '');
  }

  async function openAssign(member) {
    setAssignMember(member);
    setActionError(null);
    setCurrentError(null);
    setCurrentAssignment(null);
    assignForm.reset({ coachAccountId: '', reason: '' });
    setCurrentLoading(true);
    try {
      setCurrentAssignment(await getActiveCoachAssignment(member.memberAccountId));
    } catch (loadError) {
      setCurrentError(loadError);
    } finally {
      setCurrentLoading(false);
    }
  }

  function closeAssign() {
    if (submitting) return;
    setAssignMember(null);
    setActionError(null);
    setCurrentError(null);
  }

  async function submitAssignment(values) {
    if (!assignMember) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const coach = workloads.find((item) => item.coachAccountId === values.coachAccountId);
      await assignCoach(assignMember.memberAccountId, {
        coachAccountId: values.coachAccountId,
        reason: values.reason.trim() || null,
      });
      setNotice(
        `${assignMember.fullName} đã được phân công cho ${coach?.fullName || 'HLV đã chọn'}.`,
      );
      setAssignMember(null);
      assignForm.reset({ coachAccountId: '', reason: '' });
      await Promise.allSettled([loadCandidates(), loadWorkloads()]);
    } catch (submitError) {
      setActionError(submitError);
      if (submitError?.response?.data?.code === 'COACH_ASSIGNMENT_CONFLICT') {
        loadCandidates();
      }
      if (submitError?.response?.data?.code === 'COACH_CAPACITY_EXCEEDED') {
        loadWorkloads();
        assignForm.setValue('coachAccountId', '');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory(member) {
    setHistoryMember(member);
    setHistoryCurrent(null);
    setHistoryPage(null);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const [current, history] = await Promise.all([
        getActiveCoachAssignment(member.memberAccountId),
        listCoachAssignmentHistory(member.memberAccountId, { page: 0, size: 20 }),
      ]);
      setHistoryCurrent(current);
      setHistoryPage(history);
    } catch (loadError) {
      setHistoryError(loadError);
    } finally {
      setHistoryLoading(false);
    }
  }

  const rows = candidates.content || [];
  const totalPages = Math.max(1, candidates.totalPages || 1);
  const canPrev = page > 0;
  const canNext = candidates.totalPages > 0 && page < candidates.totalPages - 1;
  const knownActionError = businessMessage(actionError);

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Phân công huấn luyện viên</h1>
        <p className="text-muted mb-0">
          Tìm hội viên có quyền huấn luyện cá nhân, tham khảo tải hiện tại và phân công HLV.
        </p>
      </header>

      {notice ? (
        <Alert variant="success" dismissible onClose={() => setNotice('')}>
          {notice}
        </Alert>
      ) : null}

      <Row className="g-3 align-items-start">
        <Col xl={8}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="border-bottom">
              <div className="d-flex flex-wrap gap-3 align-items-end">
                <Form onSubmit={submitSearch} style={{ minWidth: 260, flex: '1 1 360px' }}>
                  <Form.Label className="small text-muted mb-1">Tìm hội viên</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Mã, họ tên, SĐT hoặc email…"
                      maxLength={100}
                    />
                    <Button type="submit" variant="outline-danger">Tìm</Button>
                    {searchInput ? (
                      <Button type="button" variant="outline-secondary" onClick={clearSearch}>✕</Button>
                    ) : null}
                  </InputGroup>
                </Form>
                <div>
                  <div className="small text-muted mb-1">Trạng thái phân công</div>
                  <ButtonGroup size="sm">
                    {STATUS_FILTERS.map((filter) => (
                      <Button
                        key={filter.value}
                        type="button"
                        variant={assignmentStatus === filter.value ? 'danger' : 'outline-danger'}
                        onClick={() => setParam('assignmentStatus', filter.value)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </ButtonGroup>
                </div>
              </div>
            </Card.Body>

            <ErrorAlert error={error} title="Không tải được hàng chờ phân công HLV" />

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
            ) : rows.length === 0 ? (
              <EmptyState
                title="Không có hội viên phù hợp"
                message={
                  assignmentStatus === ASSIGNMENT_CANDIDATE_STATUS.UNASSIGNED
                    ? 'Không còn hội viên đủ điều kiện đang chờ phân công HLV.'
                    : 'Thử thay đổi trạng thái hoặc từ khóa tìm kiếm.'
                }
              />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Hội viên</th>
                      <th>Liên hệ</th>
                      <th>Quyền coaching đến</th>
                      <th>Phân công</th>
                      <th className="text-end">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((member) => (
                      <tr key={member.memberAccountId}>
                        <td>
                          <Link
                            to={`/manager/members/${member.memberAccountId}`}
                            className="fw-semibold text-decoration-none"
                          >
                            {member.fullName || '—'}
                          </Link>
                          <div className="small text-muted">{member.memberCode || '—'}</div>
                        </td>
                        <td>
                          <div>{member.phone || '—'}</div>
                          <div className="small text-muted text-break">{member.email || '—'}</div>
                        </td>
                        <td>{formatInstant(member.membershipEndsAt)}</td>
                        <td>
                          <Badge bg={member.assignmentStatus === 'ASSIGNED' ? 'success' : 'warning'}
                            text={member.assignmentStatus === 'ASSIGNED' ? undefined : 'dark'}>
                            {member.assignmentStatus === 'ASSIGNED' ? 'Đã có HLV' : 'Chưa có HLV'}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <div className="d-flex flex-wrap justify-content-end gap-2">
                            <Button
                              type="button"
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => openHistory(member)}
                            >
                              Lịch sử
                            </Button>
                            <Button
                              type="button"
                              variant="outline-danger"
                              size="sm"
                              onClick={() => openAssign(member)}
                            >
                              {member.assignmentStatus === 'ASSIGNED' ? 'Đổi HLV' : 'Gán HLV'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {rows.length > 0 ? (
              <Card.Footer className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
                <small className="text-muted">
                  Trang {page + 1}/{totalPages} · Tổng {candidates.totalElements} hội viên
                </small>
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={!canPrev || loading}
                    onClick={() => setParam('page', String(page - 1))}
                  >
                    ← Trang trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={!canNext || loading}
                    onClick={() => setParam('page', String(page + 1))}
                  >
                    Trang sau →
                  </Button>
                </div>
              </Card.Footer>
            ) : null}
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 className="h6 fw-bold mb-1">Tải huấn luyện viên</h2>
                  <p className="small text-muted mb-0">Số hội viên đang phụ trách trên giới hạn được cấu hình.</p>
                </div>
                <Button type="button" variant="outline-secondary" size="sm" onClick={loadWorkloads}
                  disabled={workloadsLoading}>
                  Tải lại
                </Button>
              </div>
              <ErrorAlert error={workloadsError} title="Không tải được workload HLV" />
              {workloadsLoading ? (
                <div className="text-center py-4"><Spinner animation="border" size="sm" variant="danger" /></div>
              ) : workloads.length === 0 && !workloadsError ? (
                <p className="small text-muted mb-0">Chưa có HLV đang hoạt động.</p>
              ) : (
                <div className="d-grid gap-2">
                  {workloads.map((coach) => (
                    <div key={coach.coachAccountId} className="border rounded p-2">
                      <div className="d-flex justify-content-between gap-2">
                        <span className="fw-semibold">{coach.fullName || '—'}</span>
                        <Badge bg={coach.availableForAssignment ? 'light' : 'secondary'} text={coach.availableForAssignment ? 'dark' : undefined}>
                          {coach.activeMemberCount || 0}/{coach.maximumMemberCount} hội viên
                        </Badge>
                      </div>
                      <div className="small text-muted text-break">
                        {[coach.phone, coach.email].filter(Boolean).join(' · ') || 'Chưa có liên hệ'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={Boolean(assignMember)} onHide={closeAssign} centered size="lg">
        <Form onSubmit={assignForm.handleSubmit(submitAssignment)} noValidate>
          <Modal.Header closeButton>
            <Modal.Title>
              {assignMember?.assignmentStatus === 'ASSIGNED' ? 'Đổi HLV' : 'Phân công HLV'}
              {assignMember ? ` — ${assignMember.fullName}` : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {knownActionError ? <Alert variant="danger">{knownActionError}</Alert> : null}
            {!knownActionError ? <ErrorAlert error={actionError} title="Không lưu được phân công" /> : null}
            <ErrorAlert error={currentError} title="Không tải được phân công hiện tại" />
            {currentLoading ? (
              <div className="d-flex align-items-center gap-2 small text-muted mb-3">
                <Spinner animation="border" size="sm" /> Đang kiểm tra phân công hiện tại…
              </div>
            ) : currentAssignment ? (
              <Alert variant="light" className="border small">
                HLV hiện tại: <strong>{currentAssignment.coachFullName || '—'}</strong>
              </Alert>
            ) : null}

            <Form.Group controlId="assignment-queue-coach">
              <Form.Label>Chọn huấn luyện viên *</Form.Label>
              {workloadsLoading ? (
                <div className="py-3 text-center"><Spinner animation="border" size="sm" variant="danger" /></div>
              ) : workloadsError ? (
                <Alert variant="warning" className="small">
                  Chưa tải được danh sách HLV. Đóng hộp thoại và thử tải lại workload.
                </Alert>
              ) : workloads.length === 0 ? (
                <Alert variant="warning" className="small">Không có HLV đang hoạt động để phân công.</Alert>
              ) : (
                <div className="border rounded overflow-hidden">
                  {workloads.map((coach, index) => {
                    const isCurrent = coach.coachAccountId === currentAssignment?.coachAccountId;
                    const isFull = coach.availableForAssignment === false;
                    const disabled = isCurrent || isFull;
                    return (
                      <label
                        key={coach.coachAccountId}
                        className={`d-flex align-items-start gap-2 p-3 ${index ? 'border-top' : ''} ${disabled ? 'bg-light text-muted' : ''}`}
                        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                      >
                        <Form.Check
                          type="radio"
                          value={coach.coachAccountId}
                          disabled={disabled}
                          {...assignForm.register('coachAccountId')}
                        />
                        <span className="flex-grow-1">
                          <span className="d-flex flex-wrap justify-content-between gap-2">
                            <strong>{coach.fullName || '—'}</strong>
                            <span className="small">{coach.activeMemberCount || 0}/{coach.maximumMemberCount} hội viên đang phụ trách</span>
                          </span>
                          <span className="small d-block">
                            {[coach.phone, coach.email].filter(Boolean).join(' · ') || 'Chưa có liên hệ'}
                            {isCurrent ? ' · HLV hiện tại' : ''}
                            {isFull && !isCurrent ? ' · Đã đầy' : ''}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {assignForm.formState.errors.coachAccountId ? (
                <div className="text-danger small mt-1">
                  {assignForm.formState.errors.coachAccountId.message}
                </div>
              ) : null}
            </Form.Group>

            <Form.Group controlId="assignment-queue-reason" className="mt-3">
              <Form.Label>
                {currentAssignment ? 'Lý do đổi HLV' : 'Lý do (không bắt buộc)'}
              </Form.Label>
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
            <Button type="button" variant="outline-secondary" onClick={closeAssign} disabled={submitting}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                submitting
                || currentLoading
                || workloadsLoading
                || Boolean(workloadsError)
                || workloads.length === 0
              }
            >
              {submitting ? 'Đang lưu…' : currentAssignment ? 'Xác nhận đổi HLV' : 'Xác nhận phân công'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(historyMember)} onHide={() => setHistoryMember(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Lịch sử phân công — {historyMember?.fullName || ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ErrorAlert error={historyError} title="Không tải được lịch sử phân công" />
          {historyLoading ? (
            <div className="text-center py-4"><Spinner animation="border" variant="danger" /></div>
          ) : !historyError ? (
            <>
              {historyCurrent ? (
                <Alert variant="success" className="small">
                  HLV hiện tại: <strong>{historyCurrent.coachFullName || '—'}</strong>
                  {' · '}từ {formatInstant(historyCurrent.startsAt)}
                </Alert>
              ) : (
                <Alert variant="light" className="border small">Hiện chưa có HLV được phân công.</Alert>
              )}
              {!historyPage?.content?.length ? (
                <p className="text-muted small mb-0">Chưa có lịch sử phân công.</p>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Huấn luyện viên</th>
                        <th>Bắt đầu</th>
                        <th>Kết thúc</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPage.content.map((item) => (
                        <tr key={item.id}>
                          <td>{item.coachFullName || '—'}</td>
                          <td>{formatInstant(item.startsAt)}</td>
                          <td>
                            {formatInstant(item.endsAt)}
                            {item.endReason ? <div className="small text-muted">{item.endReason}</div> : null}
                          </td>
                          <td>{item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã kết thúc'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
              {(historyPage?.totalElements || 0) > (historyPage?.content?.length || 0) ? (
                <p className="small text-muted mt-2 mb-0">
                  Hiển thị {historyPage.content.length}/{historyPage.totalElements} lần phân công gần nhất.
                </p>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={() => setHistoryMember(null)}>
            Đóng
          </Button>
          {historyMember ? (
            <Button
              as={Link}
              to={`/manager/members/${historyMember.memberAccountId}`}
              variant="outline-danger"
            >
              Xem hồ sơ hội viên
            </Button>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
