import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseCreateSchema } from '../../../schemas/courseSchemas';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { createManagerCourse, listManagerCourses } from '../../../services/courseAdminService';
import { listDisciplines } from '../../../services/disciplineService';
import { COURSE_STATUS_LABELS, getCourseErrorMessage, getCourseStatusLabel } from '../../../utils/courseUi';

const emptyForm = { code: '', name: '', description: '', disciplineId: '', imageUrl: '', defaultMinimumEnrollment: 1 };

export default function ManagerCoursesPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [] });
  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const courseForm = useForm({ resolver: zodResolver(courseCreateSchema), defaultValues: emptyForm });
  const { register, handleSubmit, reset: setForm, formState: { errors } } = courseForm;
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [coursePage, disciplineList] = await Promise.all([
        listManagerCourses({ page, size: 20 }),
        listDisciplines(),
      ]);
      setResult(coursePage);
      setDisciplines(Array.isArray(disciplineList) ? disciplineList : []);
    } catch (err) {
      setError(getCourseErrorMessage(err, 'Không tải được danh sách khóa học.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form) {

    setSaving(true);
    setError('');
    try {
      await createManagerCourse({
        ...form,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        defaultMinimumEnrollment: Number(form.defaultMinimumEnrollment),
      });
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(getCourseErrorMessage(err, 'Không tạo được khóa học.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div><h1 className="h3 mb-1">Danh mục khóa học</h1><p className="text-muted mb-0">Quản lý khóa học độc lập với lớp tập thường.</p></div>
        <Button variant="danger" onClick={() => setShowCreate(true)}>+ Tạo khóa học</Button>
      </div>
      {error && <ErrorAlert error={error} title="Không thể xử lý khóa học" onClose={() => setError('')} />}
      <div className="bg-white rounded shadow-sm p-3">
        {loading ? <div className="text-center py-5"><Spinner /></div> : (
          <Table responsive hover className="align-middle mb-0">
            <thead><tr><th>Mã</th><th>Tên khóa học</th><th>Bộ môn</th><th>Đăng ký tối thiểu</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {result.content.map((course) => <tr key={course.id}>
                <td>{course.code}</td><td>{course.name}</td><td>{course.disciplineName || '—'}</td>
                <td>{course.defaultMinimumEnrollment}</td><td><Badge bg="secondary">{getCourseStatusLabel(COURSE_STATUS_LABELS, course.status)}</Badge></td>
                <td className="text-end"><Button as={Link} to={`/manager/courses/${course.id}`} size="sm" variant="outline-danger">Chi tiết</Button></td>
              </tr>)}
              {!result.content.length && <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có khóa học.</td></tr>}
            </tbody>
          </Table>
        )}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((v) => v - 1)}>Trang trước</Button>
          <Button size="sm" variant="outline-secondary" disabled={result.last || loading} onClick={() => setPage((v) => v + 1)}>Trang sau</Button>
        </div>
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="lg">
        <Form noValidate onSubmit={handleSubmit(handleCreate)}><Modal.Header closeButton><Modal.Title>Tạo khóa học</Modal.Title></Modal.Header>
          <Modal.Body><Row className="g-3">
            <Col md={4}><Form.Label>Mã khóa học *</Form.Label><Form.Control required maxLength={50} {...register('code')} isInvalid={!!errors.code} /><Form.Control.Feedback type="invalid">{errors.code?.message}</Form.Control.Feedback></Col>
            <Col md={8}><Form.Label>Tên khóa học *</Form.Label><Form.Control required maxLength={200} {...register('name')} isInvalid={!!errors.name} /><Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback></Col>
            <Col md={8}><Form.Label>Bộ môn *</Form.Label><Form.Select required {...register('disciplineId')} isInvalid={!!errors.disciplineId}><option value="">-- Chọn bộ môn --</option>{disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Form.Select><Form.Control.Feedback type="invalid">{errors.disciplineId?.message}</Form.Control.Feedback></Col>
            <Col md={4}><Form.Label>Số đăng ký tối thiểu *</Form.Label><Form.Control required type="number" min={1} {...register('defaultMinimumEnrollment')} isInvalid={!!errors.defaultMinimumEnrollment} /><Form.Control.Feedback type="invalid">{errors.defaultMinimumEnrollment?.message}</Form.Control.Feedback></Col>
            <Col xs={12}><Form.Label>Ảnh khóa học (URL)</Form.Label><Form.Control maxLength={500} {...register('imageUrl')} isInvalid={!!errors.imageUrl} /><Form.Control.Feedback type="invalid">{errors.imageUrl?.message}</Form.Control.Feedback></Col>
            <Col xs={12}><Form.Label>Mô tả</Form.Label><Form.Control as="textarea" rows={4} maxLength={2000} {...register('description')} isInvalid={!!errors.description} /><Form.Control.Feedback type="invalid">{errors.description?.message}</Form.Control.Feedback></Col>
          </Row></Modal.Body>
          <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Hủy</Button><Button type="submit" variant="danger" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo khóa học'}</Button></Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
