import { useController } from 'react-hook-form';
import { Form } from 'react-bootstrap';
import { DateInput } from './DateInput';

// Course API timestamps are entered in the gym timezone (UTC+07).
export default function CourseDateTimeInput({ control, name, label = 'Thời gian', id = name }) {
  const { field: { ref, name: fieldName, value, onChange, onBlur }, fieldState } = useController({ control, name });
  const [date = '', time = ''] = (value || '').split('T');
  return <div className="d-flex gap-2">
    <DateInput id={id} ref={ref} name={fieldName} aria-label={`${label} - ngày`} emitInvalid
      value={date} onChange={(value) => onChange(`${value}T${time}`)}
      onBlur={onBlur} isInvalid={!!fieldState.error} />
    <Form.Control id={`${id}-time`} type="time" aria-label={`${label} - giờ`} value={time}
      onChange={(event) => onChange(`${date}T${event.target.value}`)}
      onBlur={onBlur} isInvalid={!!fieldState.error} />
  </div>;
}
