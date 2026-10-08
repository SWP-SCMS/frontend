// Manager – Create class (US24).
//
// Backend behavior (SportClassService#create):
//   - disciplineId: required, must reference an ACTIVE Discipline.
//   - name: required, trim().length in 1..150.
//   - classType: required, enum { GROUP, YOGA, PT_1_1 }.
//   - description: optional, blank -> null.
//   - status: NOT accepted on create. Every new class is created ACTIVE
//     server-side. Sending `status` in the body yields 400 MALFORMED_REQUEST.
//   - 409 CLASS_NAME_CONFLICT    -> duplicate (disciplineId, name).
//   - 409 DISCIPLINE_INACTIVE    -> chosen discipline has been deactivated.
//   - 404 DISCIPLINE_NOT_FOUND   -> chosen discipline id does not exist.
//   - 400 VALIDATION_ERROR / MALFORMED_REQUEST for body-level issues.
//
// US24-specific error handling:
//   - DISCIPLINE_INACTIVE -> inline disciplineId error + refetch the
//     discipline list so the deactivated option disappears from the
//     selector (plan §D.6).
// All domain code mappings are kept PAGE-LOCAL.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createClass } from '../../../services/sportClassService';
import { listDisciplines } from '../../../services/disciplineService';
import { applyServerErrors } from '../../../utils/serverErrors';

// Page-local schema. status is intentionally absent — backend assigns ACTIVE.
const classCreateSchema = z.object({
  disciplineId: z.string().min(1, 'Vui lòng chọn bộ môn.'),
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên lớp.')
    .max(150, 'Tên lớp không được vượt quá 150 ký tự.'),
  classType: z.enum(['GROUP', 'YOGA', 'PT_1_1'], {
    message: 'Loại lớp không hợp lệ.',
  }),
  description: z.string(),
});

const TYPE_OPTIONS = [
  { value: 'GROUP', label: 'Nhóm' },
  { value: 'YOGA', label: 'Yoga' },
  { value: 'PT_1_1', label: 'PT 1:1' },
];

export default function ClassCreatePage() {
  const navigate = useNavigate();

  const [disciplines, setDisciplines] = useState([]);
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);
  const [disciplinesError, setDisciplinesError] = useState(null);

  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(classCreateSchema),
    defaultValues: {
      disciplineId: '',
      name: '',
      classType: '',
      description: '',
    },
  });

  // Controlled value for disciplineId so the selector can be reset to
  // '' after a DISCIPLINE_INACTIVE 409 without firing a re-render with
  // an undefined form value.
  const disciplineIdValue = watch('disciplineId');

  async function fetchDisciplines() {
    setLoadingDisciplines(true);
    setDisciplinesError(null);
    try {
      const all = await listDisciplines();
      const active = (Array.isArray(all) ? all : [])
        .filter((d) => d.status === 'ACTIVE')
        .slice()
        .sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'vi'),
        );
      setDisciplines(active);
    } catch (err) {
      setDisciplinesError(err);
    } finally {
      setLoadingDisciplines(false);
    }
  }

  useEffect(() => {
    fetchDisciplines();
  }, []);

  async function onSubmit(data) {
    setServerError(null);
    try {
      const created = await createClass({
        disciplineId: data.disciplineId,
        name: data.name.trim(),
        classType: data.classType,
        description: data.description.trim(),
      });
      navigate(`/manager/classes/${created.id}`, { replace: true });
    } catch (err) {
      // Shared helper: data.errors[field].
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: ['disciplineId', 'name', 'classType', 'description'],
      });

      const code = err?.response?.data?.code;
      const fieldErrors = err?.response?.data?.errors;
      const alreadyMappedName = hasFieldMessage(fieldErrors, 'name');
      const alreadyMappedDisc = hasFieldMessage(fieldErrors, 'disciplineId');

      // PAGE-LOCAL domain conflicts.
      if (code === 'CLASS_NAME_CONFLICT' && !alreadyMappedName) {
        setError('name', {
          type: 'server',
          message: 'Tên lớp đã tồn tại trong bộ môn đã chọn.',
        });
      }
      if (code === 'DISCIPLINE_INACTIVE' && !alreadyMappedDisc) {
        setError('disciplineId', {
          type: 'server',
          message: 'Bộ môn đã ngưng hoạt động. Vui lòng chọn bộ môn khác.',
        });
      }
      if (code === 'DISCIPLINE_NOT_FOUND' && !alreadyMappedDisc) {
        setError('disciplineId', {
          type: 'server',
          message: 'Bộ môn không tồn tại.',
        });
      }

      // Global ErrorAlert is the shared-helper path's fallback: only
      // raised when the helper did NOT handle the error. Page-local
      // mappings above are independent and are preserved as-is.
      if (!handled) {
        setServerError(err);
      }

      // After DISCIPLINE_INACTIVE, the previously-selected discipline is
      // no longer a valid choice. Clear the stale UUID from form state
      // so the controlled <Form.Select> cannot visually retain a value
      // that is no longer in the option list, then refetch so the
      // deactivated discipline disappears from the dropdown. The manager
      // must explicitly select a different ACTIVE discipline before
      // resubmitting.
      if (code === 'DISCIPLINE_INACTIVE') {
        setValue('disciplineId', '', { shouldValidate: false });
        fetchDisciplines();
      }
    }
  }

  const noActiveDisciplines =
    !loadingDisciplines &&
    !disciplinesError &&
    disciplines.length === 0;
  const submitDisabled =
    isSubmitting || loadingDisciplines || noActiveDisciplines;

  return (
    <div>
      <Link
        to="/manager/classes"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo lớp mới</h1>
      <p className="text-muted mb-4">
        Lớp mới được tạo với trạng thái ACTIVE.
      </p>

      <ErrorAlert
        error={disciplinesError}
        title="Không tải được danh sách bộ môn"
        onClose={() => setDisciplinesError(null)}
      />

      <ErrorAlert
        error={serverError}
        title="Không tạo được lớp"
        onClose={() => setServerError(null)}
      />

      {noActiveDisciplines ? (
        <Alert variant="warning">
          Chưa có bộ môn ACTIVE để gán lớp. Hãy tạo / kích hoạt ít nhất
          một bộ môn trước khi tạo lớp.{' '}
          <Alert.Link href="/manager/disciplines/new">
            Tạo bộ môn mới
          </Alert.Link>
          .
        </Alert>
      ) : null}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="create-disciplineId">
          <Form.Label>Bộ môn *</Form.Label>
          <Form.Select
            {...register('disciplineId')}
            value={disciplineIdValue}
            isInvalid={Boolean(errors.disciplineId)}
            disabled={loadingDisciplines || Boolean(disciplinesError)}
          >
            <option value="">-- Chọn bộ môn --</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.disciplineId?.message}
          </Form.Control.Feedback>
          <Form.Text className="text-muted">
            Chỉ hiển thị các bộ môn đang ACTIVE.
          </Form.Text>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-name">
          <Form.Label>Tên lớp *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={150}
            placeholder="VD: Yoga cơ bản"
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-classType">
          <Form.Label>Loại lớp *</Form.Label>
          <Form.Select
            {...register('classType')}
            isInvalid={Boolean(errors.classType)}
          >
            <option value="">-- Chọn loại lớp --</option>
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

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
            placeholder="Mô tả ngắn về lớp học…"
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu lớp không cần mô tả.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitDisabled}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo lớp'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/classes')}
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
