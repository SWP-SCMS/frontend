import { useController } from 'react-hook-form';
import { Form } from 'react-bootstrap';
import { DateInput } from './DateInput';
import { SESSION_SLOTS } from '../../utils/sessionSlots';
export default function SessionDateSlotInput({ control, startName = 'startAt', endName = 'endAt', label = 'Buổi học' }) {
  const { field: start, fieldState: startState } = useController({ control, name: startName });
  const { field: end, fieldState: endState } = useController({ control, name: endName });
  const [date = '', startTime = ''] = (start.value || '').split('T');
  const [endDate = '', endTime = ''] = (end.value || '').split('T');
  const selected = date === endDate && SESSION_SLOTS.find(s => s.start === startTime && s.end === endTime);
  const legacy = !selected && startTime && endTime;
  return <div className="row g-2">
    <div className="col-md-6"><Form.Label htmlFor={`${startName}-date`}>Ngày học *</Form.Label><DateInput id={`${startName}-date`} aria-label={`${label} - ngày`} value={date} emitInvalid onChange={value => {
      start.onChange(`${value}T${startTime}`); end.onChange(`${value}T${endTime}`);
    }} /></div>
    <div className="col-md-6"><Form.Label htmlFor={`${startName}-slot`}>Khung giờ *</Form.Label><Form.Select id={`${startName}-slot`} aria-label={`${label} - slot`} value={selected?.id || (legacy ? 'legacy' : '')} onChange={event => {
      const slot = SESSION_SLOTS.find(s => s.id === event.target.value);
      start.onChange(`${date}T${slot?.start || ''}`); end.onChange(`${date}T${slot?.end || ''}`);
    }}><option value="">— Chọn slot —</option>{legacy && <option value="legacy">Giờ hiện tại · {startTime}–{endTime}</option>}{SESSION_SLOTS.map(slot => <option value={slot.id} key={slot.id}>{slot.label} · {slot.start}–{slot.end}</option>)}</Form.Select></div>
    {(startState.error || endState.error) && <div className="text-danger small">{startState.error?.message || endState.error?.message}</div>}
  </div>;
}
