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
// generic ErrorAlert. The 409 mapping is kept PAGE-LOCAL; the shared
// serverErrors helper only handles EMAIL/PHONE uniqueness.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createDiscipline } from '../../../services/disciplineService';
import { applyServerErrors } from '../../../utils/serverErrors';

// Page-local schema. Status is intentionally absent — the backend assigns
// ACTIVE automatically; including the key here would invite accidental
// sending.
const disciplineCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên bộ môn.')
    .max(150, 'Tên bộ môn đã quá dài (tối đa 150 ký tự).'),
  description: z.string(),
});

export default function DisciplineCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(disciplineCreateSchema),
    defaultValues: { name: '', description: '' },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      const created = await createDiscipline({
        name: data.name.trim(),
        description: data.description.trim(),
      });
      navigate(`/manager/disciplines/${created.id}`, { replace: true });
    } catch (err) {
      // Shared helper: data.errors[field] (Spring ProblemDetail).
      // Allowlist MUST match the fields this page renders / registers.
      // EMAIL_ALREADY_EXISTS / PHONE_ALREADY_EXISTS do not apply here
      // but we still pass the full list so a stray per-field error from
      // a future backend change does not silently suppress ErrorAlert.
      const handled = applyServerErrors(err, setError, {
        fields: ['name', 'description'],
      });

      // PAGE-LOCAL: DISCIPLINE_NAME_CONFLICT.
      const code = err?.response?.data?.code;
      if (code === 'DISCIPLINE_NAME_CONFLICT') {
        // Only set if RHF has not already populated the name error
        // through data.errors, so we don't double-show.
        if (!errors.name) {
          setError('name', {
            type: 'server',
            message: 'Tên bộ môn đã tồn tại.',
          });
        }
      }

      // Global ErrorAlert is the shared-helper path's fallback: only
      // raised when the helper did NOT handle the error. The page-local
      // DISCIPLINE_NAME_CONFLICT mapping above is independent and is
      // preserved as-is.
      if (!handled) {
        setServerError(err);
      }
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
        error={serverError}
        title="Không tạo được bộ môn"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="create-name">
          <Form.Label>Tên bộ môn *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            placeholder="VD: Yoga"
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
            placeholder="Mô tả ngắn về bộ môn…"
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu bộ môn không cần mô tả.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
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
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
