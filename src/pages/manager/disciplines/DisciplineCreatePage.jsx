// Manager – Create discipline (US23).
//
// Backend behavior (DisciplineService#create):
//   - name: required, @NotBlank, @Size(max=150).
//   - description: optional, blank -> null.
//   - status: NOT accepted on create. Every new discipline is created ACTIVE
//     server-side. Sending a `status` key in the body yields 400
//     MALFORMED_REQUEST (record has no such field).
//   - Duplicate name (case-sensitive after trim) -> 409 DISCIPLINE_NAME_CONFLICT.
//
// We map the duplicate-name 409 to the inline `name` field error so the
// manager can immediately see which field is at fault, and also surface the
// generic ErrorAlert.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { createDiscipline } from '../../../services/disciplineService';

const emptyForm = {
  name: '',
  description: '',
};

const emptyErrors = {};

function pickFieldErrors(err) {
  const data = err?.response?.data;
  if (data && data.errors && typeof data.errors === 'object') {
    return data.errors;
  }
  return {};
}

export default function DisciplineCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState(emptyErrors);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) {
      next.name = 'Vui lòng nhập tên bộ môn.';
    } else if (form.name.trim().length > 150) {
      next.name = 'Tên bộ môn không được vượt quá 150 ký tự.';
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setError(null);
      return;
    }
    setErrors(emptyErrors);
    setError(null);
    setSubmitting(true);
    try {
      const created = await createDiscipline({
        name: form.name.trim(),
        description: form.description.trim(),
      });
      navigate(`/manager/disciplines/${created.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = pickFieldErrors(err);
      const code = err?.response?.data?.code;
      if (code === 'DISCIPLINE_NAME_CONFLICT' && !fieldErrors.name) {
        fieldErrors.name = 'Tên bộ môn đã tồn tại.';
      }
      setErrors(fieldErrors);
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        to="/manager/disciplines"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo bộ môn mới</h1>
      <p className="text-muted mb-4">
        Bộ môn mới được tạo với trạng thái ACTIVE.
      </p>

      <ErrorAlert
        error={error}
        title="Không tạo được bộ môn"
        onClose={() => setError(null)}
      />

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group controlId="create-name">
          <Form.Label>Tên bộ môn *</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={150}
            placeholder="VD: Yoga"
            required
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name || 'Vui lòng nhập tên bộ môn.'}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Mô tả ngắn về bộ môn…"
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu bộ môn không cần mô tả.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo bộ môn'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/disciplines')}
            disabled={submitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}