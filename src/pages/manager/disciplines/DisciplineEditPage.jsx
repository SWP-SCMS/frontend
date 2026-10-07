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

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getDiscipline, updateDiscipline } from '../../../services/disciplineService';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — đang hoạt động.' },
  { value: 'INACTIVE', label: 'INACTIVE — đã ngưng hoạt động.' },
];

const emptyForm = {
  name: '',
  description: '',
  status: 'ACTIVE',
};

const emptyOriginal = emptyForm;
const emptyErrors = {};

function disciplineToForm(d) {
  return {
    name: d?.name || '',
    description: d?.description || '',
    status: d?.status || 'ACTIVE',
  };
}

function pickFieldErrors(err) {
  const data = err?.response?.data;
  if (data && data.errors && typeof data.errors === 'object') {
    return data.errors;
  }
  return {};
}

export default function DisciplineEditPage() {
  const { disciplineId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(emptyOriginal);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [errors, setErrors] = useState(emptyErrors);
  // 'no-changes' | 'saved' | null
  const [saved, setSaved] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaved(null);
    try {
      const data = await getDiscipline(disciplineId);
      const next = disciplineToForm(data);
      setForm(next);
      setOriginal(next);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [disciplineId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
    setSaved(null);
  }

  function buildPatch() {
    const patch = {};
    if (form.name.trim() !== (original.name || '').trim()) {
      patch.name = form.name.trim();
    }
    if (
      form.description.trim() !== (original.description || '').trim()
    ) {
      // Send empty string to signal "clear". BE normalizes blank -> null.
      patch.description = form.description.trim();
    }
    if (form.status !== original.status) {
      patch.status = form.status;
    }
    return patch;
  }

  function validateClient(patch) {
    const next = {};
    if ('name' in patch) {
      if (!patch.name) {
        next.name = 'Vui lòng nhập tên bộ môn.';
      } else if (patch.name.length > 150) {
        next.name = 'Tên bộ môn không được vượt quá 150 ký tự.';
      }
    }
    if ('status' in patch) {
      if (!STATUS_OPTIONS.some((o) => o.value === patch.status)) {
        next.status = 'Trạng thái không hợp lệ.';
      }
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(null);
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setSaved('no-changes');
      setSubmitError(null);
      setErrors(emptyErrors);
      return;
    }
    const validationErrors = validateClient(patch);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }
    setErrors(emptyErrors);
    setSubmitError(null);
    setSaving(true);
    try {
      await updateDiscipline(disciplineId, patch);
      setSaved('saved');
      navigate(`/manager/disciplines/${disciplineId}`, { replace: true });
    } catch (err) {
      const fieldErrors = pickFieldErrors(err);
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.detail || err?.response?.data?.message;
      if (code === 'DISCIPLINE_NOT_FOUND') {
        setLoadError(err);
        setSaving(false);
        return;
      }
      if (code === 'DISCIPLINE_NAME_CONFLICT' && !fieldErrors.name) {
        fieldErrors.name = 'Tên bộ môn đã tồn tại.';
      }
      if (
        code === 'VALIDATION_ERROR' &&
        /at least one field is required/i.test(message || '')
      ) {
        // FE should have caught this — show a friendly message.
        setErrors({ form: 'Vui lòng cập nhật ít nhất một trường.' });
      } else {
        setErrors(fieldErrors);
      }
      setSubmitError(err);
    } finally {
      setSaving(false);
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
        error={submitError}
        title="Không lưu được thay đổi"
        onClose={() => setSubmitError(null)}
      />
      {saved === 'no-changes' ? (
        <div className="alert alert-warning py-2 mb-3">
          Không có thay đổi để lưu.
        </div>
      ) : null}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group controlId="edit-name">
          <Form.Label>Tên bộ môn *</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={150}
            required
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name || 'Vui lòng nhập tên bộ môn.'}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
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
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                required
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
                {errors.status || 'Trạng thái không hợp lệ.'}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? (
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
              setForm(original);
              setErrors(emptyErrors);
              setSaved(null);
            }}
            disabled={saving}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => navigate(`/manager/disciplines/${disciplineId}`)}
            disabled={saving}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}