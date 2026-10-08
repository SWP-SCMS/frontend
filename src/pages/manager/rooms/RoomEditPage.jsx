// Manager – Edit room (US25).
//
// Loads via GET /api/v1/manager/rooms/{id}, then PATCHes only the
// fields that actually changed vs. the original. The PATCH body is built
// from a strict allow-list (name, capacity, status) and NEVER includes
// id / createdAt / updatedAt / version.
//
// Status is editable; flipping to INACTIVE is the only "deactivate"
// path (there is no DELETE endpoint). Helper text per US24 convention.
//
// If the user makes no edits, we skip the PATCH and render a neutral
// "Không có thay đổi để lưu." message.
//
// Errors handled:
//   400 VALIDATION_ERROR            -> per-field + generic
//   400 with "at least one field is required" -> defensive warning
//   404 ROOM_NOT_FOUND             -> back link + ErrorAlert
//   409 ROOM_NAME_CONFLICT         -> name field
//   409 ROOM_CAPACITY_CONFLICT     -> capacity field

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getRoom, updateRoom } from '../../../services/roomService';
import { applyServerErrors } from '../../../utils/serverErrors';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — đang hoạt động.' },
  { value: 'INACTIVE', label: 'INACTIVE — đã ngưng hoạt động.' },
];

// Page-local edit schema.
const roomEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên phòng.')
    .max(150, 'Tên phòng đã quá dài (tối đa 150 ký tự).'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Sức chứa phải là số nguyên dương.' })
    .int('Sức chứa phải là số nguyên dương.')
    .positive('Sức chứa phải lớn hơn 0.'),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Trạng thái không hợp lệ.',
  }),
});

function roomToForm(r) {
  return {
    name: r?.name || '',
    capacity: r?.capacity != null ? r.capacity : '',
    status: r?.status || 'ACTIVE',
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

export default function RoomEditPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);
  // 'no-changes' | null
  const [saved, setSaved] = useState(null);
  const [formLevelError, setFormLevelError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(roomEditSchema),
    defaultValues: {
      name: '',
      capacity: '',
      status: 'ACTIVE',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaved(null);
    setFormLevelError(null);
    try {
      const data = await getRoom(roomId);
      const next = roomToForm(data);
      setOriginal(next);
      reset(next);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, reset]);

  useEffect(() => {
    load();
  }, [load]);

  function buildPatch(data) {
    const patch = {};
    if (data.name.trim() !== (original?.name || '').trim()) {
      patch.name = data.name.trim();
    }
    // capacity comes from RHF as a number (coerced by Zod)
    if (Number(data.capacity) !== Number(original?.capacity)) {
      patch.capacity = Number(data.capacity);
    }
    if (data.status !== original?.status) {
      patch.status = data.status;
    }
    return patch;
  }

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
      await updateRoom(roomId, patch);
      setSaved('saved');
      navigate(`/manager/rooms/${roomId}`, { replace: true });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.detail || err?.response?.data?.message;

      if (code === 'ROOM_NOT_FOUND') {
        setLoadError(err);
        return;
      }

      let sharedHandled = false;
      // Tracks whether a PAGE-LOCAL mapping handled the error so the
      // global ErrorAlert is suppressed for that case (prevents a known
      // domain conflict from being rendered twice — inline + global).
      let pageLocalHandled = false;

      // PAGE-LOCAL domain conflicts.
      if (code === 'ROOM_NAME_CONFLICT' && !hasFieldMessage(fieldErrors, 'name')) {
        setError('name', {
          type: 'server',
          message: 'Tên phòng đã tồn tại.',
        });
        pageLocalHandled = true;
      }

      if (code === 'ROOM_CAPACITY_CONFLICT') {
        setError('capacity', {
          type: 'server',
          message:
            'Sức chứa mới thấp hơn sức chứa của buổi tập đang hoạt động. Vui lòng tăng sức chứa hoặc hủy/di chuyển các buổi tập.',
        });
        pageLocalHandled = true;
      }

      if (
        code === 'VALIDATION_ERROR' &&
        /at least one field is required/i.test(message || '')
      ) {
        setFormLevelError('Vui lòng cập nhật ít nhất một trường.');
      } else if (fieldErrors && typeof fieldErrors === 'object') {
        // Shared helper: per-field errors restricted to the rendered editable fields.
        sharedHandled = applyServerErrors(err, setError, {
          fields: ['name', 'capacity', 'status'],
        });
      }

      // Global ErrorAlert is the fallback: only raised when NEITHER the
      // shared helper NOR a page-local mapping handled the error. This
      // prevents known domain conflicts (ROOM_NAME_CONFLICT,
      // ROOM_CAPACITY_CONFLICT) and successful per-field mapping from
      // also being rendered as a redundant global ErrorAlert.
      if (!sharedHandled && !pageLocalHandled) {
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
          to="/manager/rooms"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={loadError}
          title="Không tải được phòng"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/manager/rooms/${roomId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa phòng</h1>
      <p className="text-muted mb-4">
        Cập nhật tên, sức chứa hoặc trạng thái. Mã phòng{' '}
        <code className="small">{roomId}</code>.
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
          <Form.Label>Tên phòng *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-capacity">
          <Form.Label>Sức chứa *</Form.Label>
          <Form.Control
            type="number"
            min={1}
            step={1}
            {...register('capacity')}
            isInvalid={Boolean(errors.capacity)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.capacity?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-status">
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
            onClick={() => navigate(`/manager/rooms/${roomId}`)}
            disabled={isSubmitting}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}
