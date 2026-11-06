import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { uploadCourseImage } from '../../services/courseAdminService';

export default function CourseImageField({ id, form, disabled, onUploading }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const imageUrl = form.watch('imageUrl');
  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPEG hoặc PNG.'); return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError('Ảnh phải có nội dung và không vượt quá 5 MiB.'); return;
    }
    setUploading(true); onUploading(true);
    try {
      const url = await uploadCourseImage(file);
      form.setValue('imageUrl', url, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      setError(err.response?.status === 413 ? 'Ảnh không được vượt quá 5 MiB.' : 'Không tải được ảnh. Vui lòng kiểm tra ảnh JPEG/PNG và thử lại.');
    } finally { setUploading(false); onUploading(false); }
  }
  return <>
    <Form.Label htmlFor={id}>Ảnh khóa học (URL)</Form.Label>
    <Form.Control id={id} maxLength={500} {...form.register('imageUrl')} disabled={disabled || uploading} isInvalid={!!form.formState.errors.imageUrl} />
    <Form.Control.Feedback type="invalid">{form.formState.errors.imageUrl?.message}</Form.Control.Feedback>
    <Form.Label htmlFor={`${id}-file`} className="mt-2">Chọn ảnh từ máy</Form.Label>
    <Form.Control id={`${id}-file`} type="file" accept="image/jpeg,image/png" disabled={disabled || uploading} onChange={selectFile} />
    {uploading && <div role="status" className="mt-2">Đang tải ảnh…</div>}
    {error && <div role="alert" className="text-danger mt-2">{error}</div>}
    {imageUrl && <img src={imageUrl} alt="Ảnh khóa học xem trước" className="d-block rounded mt-2" style={{ maxWidth: '100%', width: 240, maxHeight: 160, objectFit: 'contain' }} />}
  </>;
}
