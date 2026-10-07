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

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass, updateClass } from '../../../services/sportClassService';

const TYPE_OPTIONS = [
  { value: 'GROUP', label: 'Nhóm' },
  { value: 'YOGA', label: 'Yoga' },
  { value: 'PT_1_1', label: 'PT 1:1' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — đang hoạt động.' },
  { value: 'INACTIVE', label: 'INACTIVE — đã ngưng hoạt động.' },
];

const emptyForm = {
  name: '',
  classType: '',
  description: '',
  status: 'ACTIVE',
};

const emptyErrors = {};

function classToForm(c) {
  return {
    name: c?.name || '',
    classType: c?.classType || '',
    description: c?.description || '',
    status: c?.status || 'ACTIVE',
  };
}

function pickFieldErrors(err) {
  const data = err?.response?.data;
  if (data && data.errors && typeof data.errors === 'object') {
    return data.errors;
  }
  return {};
}

export default function ClassEditPage() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(emptyForm);
  const [disciplineDisplay, setDisciplineDisplay] = useState(null);
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
      const data = await getClass(classId);
      const next = classToForm(data);
      setForm(next);
      setOriginal(next);
      setDisciplineDisplay(
        data
          ? { id: data.disciplineId, name: data.disciplineName }
          : null,
      );
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

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
    if (form.classType !== original.classType) {
      patch.classType = form.classType;
    }
    if (form.status !== original.status) {
      patch.status = form.status;
    }
    // disciplineId is intentionally never included.
    return patch;
  }

  function validateClient(patch) {
    const next = {};
    if ('name' in patch) {
      if (!patch.name) {
        next.name = 'Vui lòng nhập tên lớp.';
      } else if (patch.name.length > 150) {
        next.name = 'Tên lớp không được vượt quá 150 ký tự.';
      }
    }
    if ('classType' in patch) {
      if (!TYPE_OPTIONS.some((o) => o.value === patch.classType)) {
        next.classType = 'Loại lớp không hợp lệ.';
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
      await updateClass(classId, patch);
      setSaved('saved');
      navigate(`/manager/classes/${classId}`, { replace: true });
    } catch (err) {
      const fieldErrors = pickFieldErrors(err);
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.detail || err?.response?.data?.message;
      if (code === 'CLASS_NOT_FOUND') {
        // The class no longer exists at save time. Surface this as a
        // save failure (title "Không lưu được thay đổi") so the
        // manager sees a consistent save-error context, and keep
        // the form on screen so they can copy values out before
        // navigating back. The initial getClass() failure still uses
        // the load-error block with title "Không tải được lớp".
        if (!fieldErrors.name) {
          fieldErrors.name =
            'Lớp học không còn tồn tại. Vui lòng quay lại danh sách.';
        }
        setErrors(fieldErrors);
        setSubmitError(err);
        return;
      }
      if (code === 'CLASS_NAME_CONFLICT' && !fieldErrors.name) {
        fieldErrors.name = 'Tên lớp đã tồn tại trong bộ môn đã chọn.';
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
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={150}
            required
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name || 'Vui lòng nhập tên lớp.'}
          </Form.Control.Feedback>
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="edit-classType">
              <Form.Label>Loại lớp *</Form.Label>
              <Form.Select
                value={form.classType}
                onChange={(e) => update('classType', e.target.value)}
                required
                isInvalid={Boolean(errors.classType)}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.classType || 'Vui lòng chọn loại lớp.'}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
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
                Thay đổi từ ACTIVE sang INACTIVE để ngưng hoạt động. Đây
                là thao tác có thể đảo ngược, không phải xoá.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.status || 'Trạng thái không hợp lệ.'}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu lớp không cần mô tả.
          </Form.Text>
        </Form.Group>

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
            onClick={() => navigate(`/manager/classes/${classId}`)}
            disabled={saving}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}