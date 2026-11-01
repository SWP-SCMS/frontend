import { useController } from 'react-hook-form';
import { Form } from 'react-bootstrap';
import { DateInput } from './DateInput';

// Course API timestamps are entered in the gym timezone (UTC+07).
export default function CourseDateTimeInput({ control, name }) {
  const { field: { ref, name: fieldName, value, onChange, onBlur }, fieldState } = useController({ control, name });
  const [date = '', time = ''] = (value || '').split('T');
  return <div className="d-flex gap-2">
    <DateInput ref={ref} name={fieldName} aria-label="Ngày" emitInvalid
      value={date} onChange={(value) => onChange(`${value}T${time}`)}
      onBlur={onBlur} isInvalid={!!fieldState.error} />
    <Form.Control type="time" aria-label="Giờ" value={time}
      onChange={(event) => onChange(`${date}T${event.target.value}`)}
      onBlur={onBlur} isInvalid={!!fieldState.error} />
  </div>;
}
