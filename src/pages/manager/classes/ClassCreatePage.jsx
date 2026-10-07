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

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createClass } from '../../../services/sportClassService';
import { listDisciplines } from '../../../services/disciplineService';

const TYPE_OPTIONS = [
  { value: '', label: '-- Chọn loại lớp --' },
  { value: 'GROUP', label: 'Nhóm' },
  { value: 'YOGA', label: 'Yoga' },
  { value: 'PT_1_1', label: 'PT 1:1' },
];

const emptyForm = {
  disciplineId: '',
  name: '',
  classType: '',
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

export default function ClassCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState(emptyErrors);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [disciplines, setDisciplines] = useState([]);
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);
  const [disciplinesError, setDisciplinesError] = useState(null);

  // Initial discipline fetch (and re-fetch on DISCIPLINE_INACTIVE).
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
    if (!form.disciplineId) {
      next.disciplineId = 'Vui lòng chọn bộ môn.';
    }
    if (!form.name.trim()) {
      next.name = 'Vui lòng nhập tên lớp.';
    } else if (form.name.trim().length > 150) {
      next.name = 'Tên lớp không được vượt quá 150 ký tự.';
    }
    if (!form.classType) {
      next.classType = 'Vui lòng chọn loại lớp.';
    } else if (
      !TYPE_OPTIONS.some(
        (o) => o.value && o.value === form.classType,
      )
    ) {
      next.classType = 'Loại lớp không hợp lệ.';
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }
    setErrors(emptyErrors);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload = {
        disciplineId: form.disciplineId,
        name: form.name.trim(),
        classType: form.classType,
        description: form.description.trim(),
      };
      const created = await createClass(payload);
      navigate(`/manager/classes/${created.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = pickFieldErrors(err);
      const code = err?.response?.data?.code;
      if (code === 'CLASS_NAME_CONFLICT' && !fieldErrors.name) {
        fieldErrors.name = 'Tên lớp đã tồn tại trong bộ môn đã chọn.';
      }
      if (code === 'DISCIPLINE_INACTIVE' && !fieldErrors.disciplineId) {
        fieldErrors.disciplineId =
          'Bộ môn đã ngưng hoạt động. Vui lòng chọn bộ môn khác.';
      }
      if (code === 'DISCIPLINE_NOT_FOUND' && !fieldErrors.disciplineId) {
        fieldErrors.disciplineId = 'Bộ môn không tồn tại.';
      }
      setErrors(fieldErrors);
      setSubmitError(err);
      // After DISCIPLINE_INACTIVE, the previously-selected discipline is
      // no longer a valid choice. Clear the stale UUID from form state
      // (so a controlled <Form.Select> cannot visually retain a value
      // that is no longer in the option list), then refetch so the
      // deactivated discipline disappears from the dropdown. The
      // manager must explicitly select a different ACTIVE discipline
      // before resubmitting.
      if (code === 'DISCIPLINE_INACTIVE') {
        setForm((f) => ({ ...f, disciplineId: '' }));
        fetchDisciplines();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const noActiveDisciplines =
    !loadingDisciplines &&
    !disciplinesError &&
    disciplines.length === 0;
  const submitDisabled = submitting || loadingDisciplines || noActiveDisciplines;

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
        error={submitError}
        title="Không tạo được lớp"
        onClose={() => setSubmitError(null)}
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

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group controlId="create-disciplineId">
          <Form.Label>Bộ môn *</Form.Label>
          <Form.Select
            value={form.disciplineId}
            onChange={(e) => update('disciplineId', e.target.value)}
            required
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
            {errors.disciplineId || 'Vui lòng chọn bộ môn.'}
          </Form.Control.Feedback>
          <Form.Text className="text-muted">
            Chỉ hiển thị các bộ môn đang ACTIVE.
          </Form.Text>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-name">
          <Form.Label>Tên lớp *</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={150}
            placeholder="VD: Yoga cơ bản"
            required
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name || 'Vui lòng nhập tên lớp.'}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-classType">
          <Form.Label>Loại lớp *</Form.Label>
          <Form.Select
            value={form.classType}
            onChange={(e) => update('classType', e.target.value)}
            required
            isInvalid={Boolean(errors.classType)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'blank-type'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.classType || 'Vui lòng chọn loại lớp.'}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Mô tả ngắn về lớp học…"
          />
          <Form.Text className="text-muted">
            Không bắt buộc. Để trống nếu lớp không cần mô tả.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitDisabled}>
            {submitting ? (
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
            disabled={submitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}