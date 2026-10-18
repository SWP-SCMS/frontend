import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from './ErrorAlert';
import { applyServerErrors } from '../../utils/serverErrors';

const MAX_BYTES = 5 * 1024 * 1024;
const uploadSchema = z.object({
  file: z
    .any()
    .refine((files) => files?.length === 1, 'Vui lòng chọn một tệp ảnh.')
    .refine(
      (files) => !files?.[0] || ['image/jpeg', 'image/png'].includes(files[0].type),
      'Chỉ chấp nhận ảnh JPEG hoặc PNG.',
    )
    .refine(
      (files) => !files?.[0] || files[0].size <= MAX_BYTES,
      'Ảnh không được vượt quá 5 MiB.',
    ),
});

export default function ProfileImageUploadControl({ onUpload, onUploaded }) {
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(uploadSchema), defaultValues: { file: null } });

  async function submit(values) {
    setServerError(null);
    setNotice(null);
    try {
      const updated = await onUpload(values.file[0]);
      reset();
      setNotice('Đã tải ảnh hồ sơ mới.');
      onUploaded(updated);
    } catch (error) {
      const handled = applyServerErrors(error, setError, { fields: ['file'] });
      if (!handled) setServerError(error);
    }
  }

  return (
    <div className="mt-2 w-100">
      <ErrorAlert error={serverError} title="Không tải được ảnh" onClose={() => setServerError(null)} />
      {notice ? <div className="text-success small mb-2">{notice}</div> : null}
      <Form.Group controlId="profile-image-file">
        <Form.Label className="small fw-semibold">Tải ảnh từ máy</Form.Label>
        <Form.Control
          type="file"
          accept="image/jpeg,image/png"
          {...register('file')}
          isInvalid={Boolean(errors.file)}
        />
        <Form.Control.Feedback type="invalid">{errors.file?.message}</Form.Control.Feedback>
        <Form.Text>JPEG hoặc PNG, tối đa 5 MiB.</Form.Text>
      </Form.Group>
      <Button
        type="button"
        variant="outline-danger"
        size="sm"
        className="mt-2"
        onClick={handleSubmit(submit)}
        disabled={isSubmitting}
      >
        {isSubmitting ? <><Spinner size="sm" animation="border" className="me-2" />Đang tải…</> : 'Tải ảnh lên'}
      </Button>
    </div>
  );
}
