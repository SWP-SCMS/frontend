import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { sessionTrainingTextSchema } from '../../../schemas/sessionTrainingSchemas';

export default function SessionTrainingEditor({ label, value, disabled, onSave, onBusy }) {
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm({
    resolver: zodResolver(sessionTrainingTextSchema), defaultValues: { content: value },
  });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  // Polling chỉ cập nhật form chưa sửa; tuyệt đối không ghi đè bản nháp.
  useEffect(() => { if (!isDirty && !inFlight.current) reset({ content: value }); }, [value, isDirty, reset]);

  async function submit(values) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    onBusy(true);
    setError(null); setSaved(false);
    try {
      const text = await onSave(values.content);
      reset({ content: text });
      setSaved(true);
    } catch (err) { setError(err); }
    finally { inFlight.current = false; onBusy(false); }
  }

  return <Form onSubmit={event => handleSubmit(submit)(event)} noValidate>
    <ErrorAlert error={error} />
    {saved && !isDirty ? <Alert variant="success" role="status">Đã lưu {label.toLocaleLowerCase('vi-VN')}.</Alert> : null}
    <Form.Group controlId={`session-training-${label}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control as="textarea" rows={5} {...register('content')} disabled={disabled || isSubmitting} isInvalid={!!errors.content} />
      <Form.Control.Feedback type="invalid">{errors.content?.message}</Form.Control.Feedback>
    </Form.Group>
    <Button className="mt-3" type="submit" disabled={disabled || isSubmitting}>{isSubmitting ? 'Đang lưu…' : `Lưu ${label.toLocaleLowerCase('vi-VN')}`}</Button>
  </Form>;
}
