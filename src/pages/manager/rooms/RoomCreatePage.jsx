// Manager – Create room (US25).
//
// Backend behavior (RoomService#create):
//   - name: required, trim().length in 1..150.
//   - capacity: required, must be > 0 (integer).
//   - status: NOT accepted on create. Every new room is created ACTIVE
//     server-side. Sending `status` in the body yields 400 MALFORMED_REQUEST.
//   - 409 ROOM_NAME_CONFLICT -> duplicate name.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createRoom } from '../../../services/roomService';
import { applyServerErrors } from '../../../utils/serverErrors';

// Page-local schema. status is intentionally absent — the backend assigns ACTIVE.
const roomCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên phòng.')
    .max(150, 'Tên phòng không được vượt quá 150 ký tự.'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Sức chứa phải là số nguyên dương.' })
    .int('Sức chứa phải là số nguyên dương.')
    .positive('Sức chứa phải lớn hơn 0.'),
});

export default function RoomCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(roomCreateSchema),
    defaultValues: {
      name: '',
      capacity: '',
    },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      const created = await createRoom({
        name: data.name.trim(),
        capacity: data.capacity,
      });
      navigate(`/manager/rooms/${created.id}`, { replace: true });
    } catch (err) {
      // Shared helper: data.errors[field].
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: ['name', 'capacity'],
      });

      const code = err?.response?.data?.code;
      const fieldErrors = err?.response?.data?.errors;

      // PAGE-LOCAL domain conflicts.
      let pageLocalHandled = false;
      if (code === 'ROOM_NAME_CONFLICT' && !hasFieldMessage(fieldErrors, 'name')) {
        setError('name', {
          type: 'server',
          message: 'Tên phòng đã tồn tại.',
        });
        pageLocalHandled = true;
      }

      // Global ErrorAlert is the fallback: only raised when NEITHER the
      // shared helper NOR a page-local mapping handled the error. This
      // prevents a known domain conflict (e.g. ROOM_NAME_CONFLICT) from
      // also being rendered as a redundant global ErrorAlert.
      if (!handled && !pageLocalHandled) {
        setServerError(err);
      }
    }
  }

  return (
    <div>
      <Link
        to="/manager/rooms"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo phòng mới</h1>
      <p className="text-muted mb-4">
        Phòng mới được tạo với trạng thái ACTIVE.
      </p>

      <ErrorAlert
        error={serverError}
        title="Không tạo được phòng"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="create-name">
          <Form.Label>Tên phòng *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            placeholder="VD: Phòng Yoga 1"
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-capacity">
          <Form.Label>Sức chứa *</Form.Label>
          <Form.Control
            type="number"
            min={1}
            step={1}
            {...register('capacity')}
            placeholder="VD: 20"
            isInvalid={Boolean(errors.capacity)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.capacity?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo phòng'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/rooms')}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}

function hasFieldMessage(fieldErrors, field) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return false;
  const list = fieldErrors[field];
  if (Array.isArray(list)) {
    return list.some((m) => typeof m === 'string' && m.trim());
  }
  return typeof list === 'string' && list.trim().length > 0;
}
