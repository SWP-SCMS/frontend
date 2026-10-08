// Manager – Edit class (US24).
//
// Loads via GET /api/v1/manager/classes/{id}, then PATCHes only the
// fields that actually changed vs. the original. The PATCH body is built
// from a strict allow-list (name, classType, description, status) and
// NEVER includes disciplineId — `SportClass.discipline` is
// `updatable=false` server-side and the DTO has no disciplineId field
// (audit §D.2 / plan §D.8).
//
// Status is editable; flipping to INACTIVE is the only "deactivate"
// path (there is no DELETE endpoint). Neutral helper text per
// plan §D.4.
//
// If the user makes no edits, we skip the PATCH and render a neutral
// "Không có thay đổi để lưu." message — we do NOT show
// "Đã lưu thay đổi." because nothing was actually saved (plan §D.9).
//
// Errors handled:
//   400 VALIDATION_ERROR            -> per-field + generic
//   400 MALFORMED_REQUEST           -> generic only
//   400 with "at least one field is required" -> defense-in-depth
//   404 CLASS_NOT_FOUND             -> back link + ErrorAlert
//   409 CLASS_NAME_CONFLICT         -> name field + generic
//
// Migration note (RHF + Zod):
//   - disciplineId is intentionally NOT in classEditSchema; it stays
//     read-only display and is never sent.
//   - validateClient(patch) preserved; Zod validates the form, not
//     the PATCH payload.
//   - PAGE-LOCAL backend codes (CLASS_*, VALIDATION_ERROR +
//     "at least one field is required") stay page-local.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass, updateClass } from '../../../services/sportClassService';
import { applyServerErrors } from '../../../utils/serverErrors';

const TYPE_OPTIONS = [
  { value: 'GROUP', label: 'Nhóm' },
  { value: 'YOGA', label: 'Yoga' },
  { value: 'PT_1_1', label: 'PT 1:1' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — đang hoạt động.' },
  { value: 'INACTIVE', label: 'INACTIVE — đã ngưng hoạt động.' },
];

// Page-local edit schema. disciplineId is intentionally NOT in the
// schema — it is immutable and never sent.
const classEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên lớp.')
    .max(150, 'Tên lớp đã quá dài (tối đa 150 ký tự).'),
  classType: z.enum(['GROUP', 'YOGA', 'PT_1_1'], {
    message: 'Loại lớp không hợp lệ.',
  }),
  description: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Trạng thái không hợp lệ.',
  }),
});

function classToForm(c) {
  return {
    name: c?.name || '',
    classType: c?.classType || '',
    description: c?.description || '',
    status: c?.status || 'ACTIVE',
  };
}

function hasFieldMessage(fieldErrors, field) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return false;
  const list = fieldErrors[field];
  if (Array.isArray(list)) {
    return list.some((m) => typeof m === 'string' && m.trim());
  }
  return typeof list === 'string' && list.trim().length > 0;
}

export default function ClassEditPage() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [original, setOriginal] = useState(null);
  const [disciplineDisplay, setDisciplineDisplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [formLevelError, setFormLevelError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(classEditSchema),
    defaultValues: {
      name: '',
      classType: '',
      description: '',
      status: 'ACTIVE',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaved(null);
    setFormLevelError(null);
    try {
      const data = await getClass(classId);
      const next = classToForm(data);
      setOriginal(next);
      setDisciplineDisplay(
        data
          ? { id: data.disciplineId, name: data.disciplineName }
          : null,
      );
      reset(next);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, reset]);

  useEffect(() => {
    load();
  }, [load]);

  function buildPatch(data) {
    const patch = {};
    if (data.name.trim() !== (original?.name || '').trim()) {
      patch.name = data.name.trim();
    }
    if (
      data.description.trim() !== (original?.description || '').trim()
    ) {
      // Send empty string to signal "clear". BE normalizes blank -> null.
      patch.description = data.description.trim();
    }
    if (data.classType !== original?.classType) {
      patch.classType = data.classType;
    }
    if (data.status !== original?.status) {
      patch.status = data.status;
    }
    // disciplineId is intentionally never included.
    return patch;
  }

  // validateClient(patch) is intentionally REMOVED. The Wave 2 gate
  // review concluded it was a byte-for-byte duplicate of the rules
  // already enforced by the page-local Zod schema on the form state.
  // PATCH-only validation (validate-only-patched-keys) is not needed
  // because every patched key's value comes from the form state, which
  // has already passed Zod parsing. The patch diff itself is the
  // PATCH-allowlist guard, not a re-validation pass.

  async function onSubmit(data) {
    setSaved(null);
    setFormLevelError(null);
    setServerError(null);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setSaved('no-changes');
      return;
    }
    try {
      await updateClass(classId, patch);
      setSaved('saved');
      navigate(`/manager/classes/${classId}`, { replace: true });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.detail || err?.response?.data?.message;
      if (code === 'CLASS_NOT_FOUND') {
        // The class no longer exists at save time. Surface as a save
        // failure (title "Không lưu được thay đổi") so the manager
        // sees a consistent save-error context, and keep the form on
        // screen so they can copy values out before navigating back.
        // Both inline (name) and global (ErrorAlert) signals are
        // intentionally preserved — the page-local CLASS_NOT_FOUND
        // contract requires both, per the Wave 2 plan.
        if (!hasFieldMessage(fieldErrors, 'name')) {
          setError('name', {
            type: 'server',
            message:
              'Lớp học không còn tồn tại. Vui lòng quay lại danh sách.',
          });
        }
        setServerError(err);
        return;
      }
      // Whether the shared helper produced at least one inline error.
      // Gates the global ErrorAlert below.
      let sharedHandled = false;
      if (
        code === 'CLASS_NAME_CONFLICT' &&
        !hasFieldMessage(fieldErrors, 'name')
      ) {
        setError('name', {
          type: 'server',
          message: 'Tên lớp đã tồn tại trong bộ môn đã chọn.',
        });
      }
      if (
        code === 'VALIDATION_ERROR' &&
        /at least one field is required/i.test(message || '')
      ) {
        setFormLevelError('Vui lòng cập nhật ít nhất một trường.');
      } else if (fieldErrors && typeof fieldErrors === 'object') {
        // Shared helper: per-field errors restricted to the rendered
        // editable fields. disciplineId is intentionally NOT in the
        // allowlist because it is immutable and never sent.
        sharedHandled = applyServerErrors(err, setError, {
          fields: ['name', 'classType', 'description', 'status'],
        });
      }
      // Global ErrorAlert is the shared-helper path's fallback: only
      // raised when the helper did NOT handle the error. Page-local
      // mappings (CLASS_NAME_CONFLICT, "at least one field") are
      // independent and are preserved as-is. CLASS_NOT_FOUND above
      // already returned with its own (intentional) both-inline-and-
      // global behavior.
      if (!sharedHandled) {
        setServerError(err);
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <Link
          to="/manager/classes"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={loadError}
          title="Không tải được lớp"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/manager/classes/${classId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa lớp học</h1>
      <p className="text-muted mb-4">
        Cập nhật tên, loại, mô tả hoặc trạng thái. Mã lớp{' '}
        <code className="small">{classId}</code>.
      </p>

      <ErrorAlert
        error={serverError}
        title="Không lưu được thay đổi"
        onClose={() => setServerError(null)}
      />
      {saved === 'no-changes' ? (
        <div className="alert alert-warning py-2 mb-3">
          Không có thay đổi để lưu.
        </div>
      ) : null}
      {formLevelError ? (
        <div className="alert alert-warning py-2 mb-3">{formLevelError}</div>
      ) : null}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="border-0 shadow-sm mb-3">
          <Card.Body>
            <h2 className="h6 text-uppercase text-muted mb-2">Bộ môn hiện tại</h2>
            <p className="mb-0">
              {disciplineDisplay?.id ? (
                <Link
                  to={`/manager/disciplines/${disciplineDisplay.id}`}
                  className="fw-semibold text-decoration-none"
                >
                  {disciplineDisplay.name || '—'}
                </Link>
              ) : (
                <span className="text-muted">—</span>
              )}
            </p>
            <Form.Text className="text-muted">
              Bộ môn không thể thay đổi sau khi tạo.
            </Form.Text>
          </Card.Body>
        </Card>

        <Form.Group controlId="edit-name">
          <Form.Label>Tên lớp *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="edit-classType">
              <Form.Label>Loại lớp *</Form.Label>
              <Form.Select
                {...register('classType')}
                isInvalid={Boolean(errors.classType)}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.classType?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-status">
              <Form.Label>Trạng thái *</Form.Label>
              <Form.Select
                {...register('status')}
                isInvalid={Boolean(errors.status)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Thay đổi từ ACTIVE sang INACTIVE để ngưng hoạt động. Đây
                là thao tác có thể đảo ngược, không phải xoá.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.status?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu lớp không cần mô tả.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang lưu…
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => {
              if (original) reset(original);
              setSaved(null);
              setFormLevelError(null);
            }}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => navigate(`/manager/classes/${classId}`)}
            disabled={isSubmitting}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}
