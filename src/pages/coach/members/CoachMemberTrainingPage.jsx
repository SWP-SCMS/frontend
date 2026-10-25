import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Spinner,
} from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import {
  createCoachTrainingPlan,
  archiveCoachTrainingPlan,
  listCoachTrainingFeedback,
  listCoachTrainingPlans,
  listCoachTrainingPlanVersions,
  listCoachTrainingResults,
  updateCoachTrainingPlan,
} from '../../../services/trainingService';
import { applyServerErrors } from '../../../utils/serverErrors';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const CONFIG = {
  plans: {
    title: 'Giáo án tập luyện',
    emptyTitle: 'Chưa có giáo án',
    emptyMessage: 'Hội viên chưa có giáo án tập luyện nào.',
    load: listCoachTrainingPlans,
  },
  results: {
    title: 'Kết quả tập luyện',
    emptyTitle: 'Chưa có kết quả',
    emptyMessage: 'Chưa có kết quả tập luyện nào được ghi nhận.',
    load: listCoachTrainingResults,
  },
  feedback: {
    title: 'Nhận xét huấn luyện',
    emptyTitle: 'Chưa có nhận xét',
    emptyMessage: 'Chưa có nhận xét nào dành cho hội viên.',
    load: listCoachTrainingFeedback,
  },
};

const TRAINING_PLAN_ERROR_MESSAGES = {
  ACTOR_NOT_ACTIVE_COACH:
    'Tài khoản huấn luyện viên không còn hoạt động nên không thể lưu giáo án.',
  COACH_ASSIGNMENT_NOT_FOUND:
    'Bạn không còn được phân công phụ trách hội viên này.',
  PLUS_MEMBERSHIP_REQUIRED:
    'Gói tập hiện tại của hội viên không có quyền lập giáo án tập luyện.',
  TRAINING_PLAN_NOT_FOUND:
    'Không tìm thấy giáo án này hoặc giáo án không thuộc hội viên đã chọn.',
  TRAINING_PLAN_NOT_ACTIVE:
    'Chỉ giáo án đang hoạt động mới có thể được cập nhật.',
  TRAINING_PLAN_VERSION_NOT_FOUND:
    'Giáo án chưa có phiên bản hợp lệ để cập nhật.',
  TRAINING_PLAN_VERSION_CONFLICT:
    'Giáo án đã được cập nhật ở nơi khác. Nội dung bạn nhập vẫn được giữ; hãy tải lại dữ liệu trước khi lưu tiếp.',
  ACTIVE_TRAINING_PLAN_CHANGED:
    'Giáo án đang hoạt động đã thay đổi. Nội dung bạn nhập vẫn được giữ; hãy kiểm tra lại trước khi xác nhận thay thế.',
};

const trainingPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên giáo án.')
    .max(200, 'Tên giáo án không được vượt quá 200 ký tự.'),
  goal: z.string().max(4000, 'Mục tiêu không được vượt quá 4000 ký tự.'),
  schedule: z.string().max(4000, 'Lịch tập không được vượt quá 4000 ký tự.'),
  exercises: z.string().superRefine((value, context) => {
    const rows = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (rows.length > 100) context.addIssue({ code: 'custom', message: 'Tối đa 100 bài tập.' });
    if (rows.some((item) => item.length > 500)) context.addIssue({ code: 'custom', message: 'Mỗi bài tập tối đa 500 ký tự.' });
  }),
  notes: z.string().max(4000, 'Ghi chú không được vượt quá 4000 ký tự.'),
});

const EMPTY_PLAN_FORM = {
  title: '',
  goal: '',
  schedule: '',
  exercises: '',
  notes: '',
};

function displayTime(item) {
  const value = item.updatedAt || item.activityAt || item.createdAt;
  return value ? `${formatGymDate(value)} · ${formatGymTime(value)}` : null;
}

function fieldToText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string' ? item : JSON.stringify(item),
      )
      .join('\n');
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function planToForm(plan) {
  const content =
    plan?.content && typeof plan.content === 'object' && !Array.isArray(plan.content)
      ? plan.content
      : {};
  return {
    title: plan?.title || '',
    goal: fieldToText(content.goal),
    schedule: fieldToText(content.schedule),
    exercises: fieldToText(content.exercises ?? content.exercise),
    notes: fieldToText(content.notes ?? content.note),
  };
}

function buildPlanContent(form) {
  const content = {};
  for (const key of ['goal', 'schedule', 'notes']) {
    const value = form[key].trim();
    if (value) content[key] = value;
  }
  const exercises = form.exercises.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (exercises.length) content.exercises = exercises;
  return content;
}

function trainingPlanErrorMessage(error) {
  const code = error?.response?.data?.code;
  return TRAINING_PLAN_ERROR_MESSAGES[code] || null;
}

export default function CoachMemberTrainingPage({ kind }) {
  const { memberAccountId } = useParams();
  const config = CONFIG[kind];
  const isPlanPage = kind === 'plans';
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [businessError, setBusinessError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [versions, setVersions] = useState(null);
  const [versionsPlan, setVersionsPlan] = useState(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [replacementPrompt, setReplacementPrompt] = useState(null);
  const [replacementSubmitting, setReplacementSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(trainingPlanSchema),
    defaultValues: EMPTY_PLAN_FORM,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await config.load(memberAccountId, { page, size: 20 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [config, memberAccountId, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateModal() {
    setSelectedPlan(null);
    setModalMode('create');
    setSaveError(null);
    setBusinessError('');
    setReplacementPrompt(null);
    reset(EMPTY_PLAN_FORM);
  }

  function openEditModal(plan) {
    setSelectedPlan(plan);
    setModalMode('edit');
    setSaveError(null);
    setBusinessError('');
    setReplacementPrompt(null);
    reset(planToForm(plan));
  }

  function closeModal() {
    if (isSubmitting || replacementSubmitting) return;
    setModalMode(null);
    setSelectedPlan(null);
    setSaveError(null);
    setBusinessError('');
    setReplacementPrompt(null);
    reset(EMPTY_PLAN_FORM);
  }

  async function onSavePlan(form) {
    setSaveError(null);
    setBusinessError('');
    setReplacementPrompt(null);
    const payload = {
      title: form.title.trim(),
      content: buildPlanContent(form),
    };
    if (modalMode === 'edit') payload.expectedVersionNumber = selectedPlan.versionNumber;

    try {
      if (modalMode === 'edit') {
        await updateCoachTrainingPlan(
          memberAccountId,
          selectedPlan.id,
          payload,
        );
        setSuccessMessage('Đã cập nhật giáo án và tạo phiên bản mới.');
      } else {
        await createCoachTrainingPlan(memberAccountId, payload);
        setSuccessMessage('Đã tạo giáo án cho hội viên.');
      }
      const completedMode = modalMode;
      setModalMode(null);
      setSelectedPlan(null);
      reset(EMPTY_PLAN_FORM);
      if (completedMode === 'create' && page !== 0) setPage(0);
      else await load();
    } catch (err) {
      if (modalMode === 'create' && err?.response?.data?.code === 'ACTIVE_TRAINING_PLAN_EXISTS') {
        const problem = err.response.data;
        setReplacementPrompt({
          payload,
          activePlanId: problem.activePlanId,
          activePlanTitle: problem.activePlanTitle,
          currentVersionNumber: problem.currentVersionNumber,
        });
        return;
      }
      applyServerErrors(err, setFieldError, {
        fields: ['title'],
      });
      const message = trainingPlanErrorMessage(err);
      if (message) setBusinessError(message);
      else setSaveError(err);
    }
  }

  async function confirmReplacePlan() {
    if (!replacementPrompt) return;
    setReplacementSubmitting(true);
    setSaveError(null);
    setBusinessError('');
    try {
      await createCoachTrainingPlan(memberAccountId, {
        ...replacementPrompt.payload,
        replaceActivePlanId: replacementPrompt.activePlanId,
        expectedActivePlanVersion: replacementPrompt.currentVersionNumber,
      });
      setSuccessMessage('Đã tạo giáo án mới và lưu trữ giáo án cũ.');
      setReplacementPrompt(null);
      setModalMode(null);
      setSelectedPlan(null);
      reset(EMPTY_PLAN_FORM);
      if (page !== 0) setPage(0);
      else await load();
    } catch (err) {
      const message = trainingPlanErrorMessage(err);
      if (err?.response?.data?.code === 'ACTIVE_TRAINING_PLAN_CHANGED') {
        setReplacementPrompt(null);
        setBusinessError(message);
      } else if (message) {
        setBusinessError(message);
      } else {
        setSaveError(err);
      }
    } finally {
      setReplacementSubmitting(false);
    }
  }

  async function openVersions(plan) {
    setVersionsPlan(plan); setVersions(null); setVersionsLoading(true); setError(null);
    try { setVersions(await listCoachTrainingPlanVersions(memberAccountId, plan.id)); }
    catch (err) { setError(err); setVersionsPlan(null); }
    finally { setVersionsLoading(false); }
  }

  async function confirmArchivePlan() {
    if (!archiveTarget) return;
    setArchivingId(archiveTarget.id); setError(null);
    try {
      await archiveCoachTrainingPlan(memberAccountId, archiveTarget.id);
      setSuccessMessage('Đã lưu trữ giáo án.');
      setArchiveTarget(null);
      await load();
    }
    catch (err) { setError(err); }
    finally { setArchivingId(null); }
  }

  return (
    <div>
      <WorkflowBreadcrumb
        items={[
          { to: '/coach/members', label: 'Hội viên được phân công' },
          { to: `/coach/members/${memberAccountId}`, label: 'Hồ sơ hội viên' },
        ]}
        current={config.title}
      />
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mt-3">
        <div>
          <h1 className="h3 fw-bold mb-1">{config.title}</h1>
          <p className="text-muted">Lịch sử do bạn quản lý cho hội viên này.</p>
        </div>
        {isPlanPage ? (
          <Button variant="danger" onClick={openCreateModal}>
            + Tạo giáo án
          </Button>
        ) : null}
      </div>
      {successMessage ? (
        <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      ) : null}
      <ErrorAlert error={error} title={`Không tải được ${config.title.toLocaleLowerCase('vi-VN')}`} />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : !result?.content?.length ? (
        <EmptyState title={config.emptyTitle} message={config.emptyMessage} />
      ) : (
        result.content.map((item, index) => (
          <Card key={item.id || `${kind}-${index}`} className="border-0 shadow-sm mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <h2 className="h6 mb-0">{item.title || `${config.title} ${index + 1}`}</h2>
                    {isPlanPage && item.status ? (
                      <Badge bg={item.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {item.status}
                      </Badge>
                    ) : null}
                    {isPlanPage && item.versionNumber ? (
                      <Badge bg="light" text="dark">
                        Phiên bản {item.versionNumber}
                      </Badge>
                    ) : null}
                  </div>
                  {displayTime(item) ? <span className="small text-muted">{displayTime(item)}</span> : null}
                </div>
                {isPlanPage ? (
                  <div className="d-flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={() => openVersions(item)}>Lịch sử</Button>
                    <Button size="sm" variant="outline-danger" disabled={item.status !== 'ACTIVE'} onClick={() => openEditModal(item)}>Cập nhật</Button>
                    <Button size="sm" variant="danger" disabled={item.status !== 'ACTIVE' || archivingId === item.id} onClick={() => setArchiveTarget(item)}>{archivingId === item.id ? 'Đang lưu trữ…' : 'Lưu trữ'}</Button>
                  </div>
                ) : null}
              </div>
              <TrainingContent value={item.content ?? item} />
              {isPlanPage ? <div className="small text-muted mt-2">Cập nhật: {item.updatedAt ? displayTime(item) : '—'} · Version tạo lúc: {item.versionCreatedAt ? `${formatGymDate(item.versionCreatedAt)} · ${formatGymTime(item.versionCreatedAt)}` : '—'} · Schema v{item.contentSchemaVersion || 1}</div> : null}
            </Card.Body>
          </Card>
        ))
      )}
      {(result?.totalPages || 0) > 1 ? (
        <div className="d-flex justify-content-between mt-3">
          <Button size="sm" variant="outline-danger" disabled={loading || page <= 0} onClick={() => setPage((value) => value - 1)}>‹ Trang trước</Button>
          <span className="small text-muted align-self-center">Trang {page + 1}/{result.totalPages}</span>
          <Button size="sm" variant="outline-danger" disabled={loading || page + 1 >= result.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau ›</Button>
        </div>
      ) : null}
      <Link to={`/coach/members/${memberAccountId}`} className="d-inline-block mt-3">← Quay lại hồ sơ hội viên</Link>

      <Modal show={Boolean(modalMode)} onHide={closeModal} centered size="lg">
        <Form onSubmit={handleSubmit(onSavePlan)} noValidate>
          <Modal.Header closeButton={!isSubmitting}>
            <Modal.Title className="h5">
              {modalMode === 'edit' ? 'Cập nhật giáo án' : 'Tạo giáo án mới'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {modalMode === 'edit' ? (
              <Alert variant="info">
                Mỗi lần lưu sẽ tạo một phiên bản mới. Phiên bản hiện tại là{' '}
                <strong>{selectedPlan?.versionNumber || '—'}</strong>.
              </Alert>
            ) : null}
            {businessError ? <Alert variant="danger">{businessError}</Alert> : null}
            {replacementPrompt ? (
              <Alert variant="warning">
                <div className="fw-semibold mb-1">Hội viên đang có một giáo án hoạt động</div>
                <div className="mb-3">
                  Giáo án “{replacementPrompt.activePlanTitle || 'Không có tên'}” sẽ được lưu trữ
                  và giáo án mới sẽ trở thành giáo án đang hoạt động.
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={replacementSubmitting}
                    onClick={confirmReplacePlan}
                  >
                    {replacementSubmitting ? 'Đang thay thế…' : 'Xác nhận thay thế'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    disabled={replacementSubmitting}
                    onClick={() => setReplacementPrompt(null)}
                  >
                    Giữ giáo án hiện tại
                  </Button>
                </div>
              </Alert>
            ) : null}
            <ErrorAlert
              error={saveError}
              title={modalMode === 'edit' ? 'Không cập nhật được giáo án' : 'Không tạo được giáo án'}
              onClose={() => setSaveError(null)}
            />

            <Form.Group className="mb-3" controlId="training-plan-title">
              <Form.Label>Tên giáo án *</Form.Label>
              <Form.Control
                {...register('title')}
                maxLength={200}
                placeholder="Ví dụ: Tăng sức bền trong 4 tuần"
                disabled={Boolean(replacementPrompt)}
                isInvalid={Boolean(errors.title)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.title?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="training-plan-goal">
              <Form.Label>Mục tiêu</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                {...register('goal')}
                placeholder="Mục tiêu huấn luyện của hội viên"
                disabled={Boolean(replacementPrompt)}
                isInvalid={Boolean(errors.goal)}
              />
              <Form.Control.Feedback type="invalid">{errors.goal?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="training-plan-schedule">
              <Form.Label>Lịch tập dự kiến</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                {...register('schedule')}
                placeholder="Ví dụ: Thứ 2, 4, 6 — 60 phút/buổi"
                disabled={Boolean(replacementPrompt)}
                isInvalid={Boolean(errors.schedule)}
              />
              <Form.Control.Feedback type="invalid">{errors.schedule?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="training-plan-exercises">
              <Form.Label>Bài tập</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                {...register('exercises')}
                placeholder={'Mỗi dòng một bài tập, ví dụ:\nSquat — 3 hiệp × 10 lần\nPlank — 3 hiệp × 45 giây'}
                disabled={Boolean(replacementPrompt)}
                isInvalid={Boolean(errors.exercises)}
              />
              <Form.Control.Feedback type="invalid">{errors.exercises?.message}</Form.Control.Feedback>
              <Form.Text className="text-muted">
                Nhập mỗi bài tập trên một dòng.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="training-plan-notes">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                {...register('notes')}
                placeholder="Lưu ý về kỹ thuật, cường độ hoặc sức khỏe"
                disabled={Boolean(replacementPrompt)}
                isInvalid={Boolean(errors.notes)}
              />
              <Form.Control.Feedback type="invalid">{errors.notes?.message}</Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeModal} disabled={isSubmitting || replacementSubmitting}>
              Hủy
            </Button>
            <Button variant="danger" type="submit" disabled={isSubmitting || replacementSubmitting || Boolean(replacementPrompt)}>
              {isSubmitting ? (
                <><Spinner animation="border" size="sm" className="me-2" />Đang lưu…</>
              ) : modalMode === 'edit' ? (
                'Lưu phiên bản mới'
              ) : (
                'Tạo giáo án'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(versionsPlan)} onHide={() => setVersionsPlan(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Lịch sử — {versionsPlan?.title}</Modal.Title></Modal.Header>
        <Modal.Body>{versionsLoading ? <div className="text-center py-4"><Spinner variant="danger" /></div> : (versions || []).map((version) => <Card key={version.id} className="mb-3"><Card.Body><div className="d-flex justify-content-between mb-2"><strong>Phiên bản {version.versionNumber}</strong><span className="small text-muted">{formatGymDate(version.createdAt)} · {formatGymTime(version.createdAt)}</span></div><div className="small text-muted mb-2">Người tạo: {version.createdByAccountId}</div><TrainingContent value={version.content} /></Card.Body></Card>)}</Modal.Body>
      </Modal>

      <Modal
        show={Boolean(archiveTarget)}
        onHide={() => !archivingId && setArchiveTarget(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!archivingId}>
          <Modal.Title className="h5">Lưu trữ giáo án</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Xác nhận lưu trữ giáo án <strong>“{archiveTarget?.title}”</strong>?
          Giáo án đã lưu trữ sẽ không thể khôi phục.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={Boolean(archivingId)} onClick={() => setArchiveTarget(null)}>
            Quay lại
          </Button>
          <Button variant="danger" disabled={Boolean(archivingId)} onClick={confirmArchivePlan}>
            {archivingId ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
