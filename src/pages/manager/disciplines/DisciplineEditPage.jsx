// Manager – Edit discipline (US23).
//
// Loads via GET /api/v1/manager/disciplines/{id}, then PATCHes only the
// fields that actually changed vs. the original. The PATCH body is built
// from a strict allow-list (name, description, status) and never includes
// id / createdAt / updatedAt / version.
//
// Status is editable; flipping to INACTIVE is the only "deactivate" path
// (there is no DELETE endpoint). Neutral helper text per plan §H-5.
//
// If the user makes no edits, we skip the PATCH and render a neutral
// "Không có thay đổi để lưu." message — we do NOT show "Đã lưu thay đổi."
// because nothing was actually saved (plan §7).
//
// Errors handled:
//   400 VALIDATION_ERROR            -> per-field + generic
//   404 DISCIPLINE_NOT_FOUND        -> back link + ErrorAlert
//   409 DISCIPLINE_NAME_CONFLICT    -> name field + generic
//   400 with empty body / empty-patch-> "Vui lòng cập nhật ít nhất một trường."
//
// Migration note (RHF + Zod):
//   - Zod validates the form state, not the PATCH payload. The
//     validateClient(patch) helper (kept in onSubmit) validates only
//     patched keys — semantics preserved exactly as before.
//   - PAGE-LOCAL backend codes (DISCIPLINE_*, VALIDATION_ERROR +
//     "at least one field is required") stay page-local.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getDiscipline, updateDiscipline } from '../../../services/disciplineService';
import { applyServerErrors } from '../../../utils/serverErrors';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — đang hoạt động.' },
  { value: 'INACTIVE', label: 'INACTIVE — đã ngưng hoạt động.' },
];

// Page-local edit schema. status is editable here (unlike Create).
// buildPatch() builds the PATCH body; this schema validates the form.
const disciplineEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên bộ môn.')
    .max(150, 'Tên bộ môn đã quá dài (tối đa 150 ký tự).'),
  description: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Trạng thái không hợp lệ.',
  }),
});

function disciplineToForm(d) {
  return {
    name: d?.name || '',
    description: d?.description || '',
    status: d?.status || 'ACTIVE',
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

export default function DisciplineEditPage() {
  const { disciplineId } = useParams();
  const navigate = useNavigate();

  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);
  // 'no-changes' | 'saved' | null
  const [saved, setSaved] = useState(null);
  // Form-level (non-field) error for the friendly "at least one field" hint.
  const [formLevelError, setFormLevelError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(disciplineEditSchema),
    defaultValues: {
      name: '',
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
      const data = await getDiscipline(disciplineId);
      const next = disciplineToForm(data);
      setOriginal(next);
      reset(next);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [disciplineId, reset]);

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
    if (data.status !== original?.status) {
      patch.status = data.status;
    }
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
      await updateDiscipline(disciplineId, patch);
      setSaved('saved');
      navigate(`/manager/disciplines/${disciplineId}`, { replace: true });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.detail || err?.response?.data?.message;
      if (code === 'DISCIPLINE_NOT_FOUND') {
        setLoadError(err);
        return;
      }
      // Whether the shared helper produced at least one inline error.
      // Gates the global ErrorAlert below.
      let sharedHandled = false;
      // PAGE-LOCAL: DISCIPLINE_NAME_CONFLICT.
      if (
        code === 'DISCIPLINE_NAME_CONFLICT' &&
        !hasFieldMessage(fieldErrors, 'name')
      ) {
        setError('name', {
          type: 'server',
          message: 'Tên bộ môn đã tồn tại.',
        });
      }
      if (
        code === 'VALIDATION_ERROR' &&
        /at least one field is required/i.test(message || '')
      ) {
        // FE should have caught this — show a friendly message.
        setFormLevelError('Vui lòng cập nhật ít nhất một trường.');
      } else if (fieldErrors && typeof fieldErrors === 'object') {
        // Shared helper: per-field errors restricted to the rendered
        // editable fields. Anything else falls through to ErrorAlert.
        sharedHandled = applyServerErrors(err, setError, {
          fields: ['name', 'description', 'status'],
        });
      }
      // Global ErrorAlert is the shared-helper path's fallback: only
      // raised when the helper did NOT handle the error. Page-local
      // mappings (DISCIPLINE_NAME_CONFLICT, "at least one field",
      // DISCIPLINE_NOT_FOUND via setLoadError) are independent and
      // are preserved as-is.
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
          to="/manager/disciplines"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={loadError}
          title="Không tải được bộ môn"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/manager/disciplines/${disciplineId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa bộ môn</h1>
      <p className="text-muted mb-4">
        Cập nhật tên, mô tả hoặc trạng thái. Mã bộ môn{' '}
        <code className="small">{disciplineId}</code>.
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
        <Form.Group controlId="edit-name">
          <Form.Label>Tên bộ môn *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu bộ môn không cần mô tả.
          </Form.Text>
        </Form.Group>

        <Row className="g-3 mt-1">
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
                ACTIVE — đang hoạt động.
                <br />
                INACTIVE — đã ngưng hoạt động.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.status?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

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
            onClick={() => navigate(`/manager/disciplines/${disciplineId}`)}
            disabled={isSubmitting}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}
