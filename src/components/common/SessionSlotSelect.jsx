import { Form } from 'react-bootstrap';
import { useController } from 'react-hook-form';
import { SESSION_SLOTS } from '../../utils/sessionSlots';
export default function SessionSlotSelect({ control, startName = 'startTime', endName = 'endTime', id = 'session-slot', disabled = false }) {
  const { field: start, fieldState: startState } = useController({ control, name: startName });
  const { field: end, fieldState: endState } = useController({ control, name: endName });
  const selected = SESSION_SLOTS.find(slot => slot.start === start.value && slot.end === end.value);
  const legacy = !selected && start.value && end.value;
  const error = startState.error?.message || endState.error?.message;
  return <Form.Group controlId={id}>
    <Form.Label>Khung giờ *</Form.Label>
    <Form.Select value={selected?.id || (legacy ? 'legacy' : '')} disabled={disabled} isInvalid={!!error}
      onBlur={() => { start.onBlur(); end.onBlur(); }}
      onChange={event => {
        const slot = SESSION_SLOTS.find(item => item.id === event.target.value);
        start.onChange(slot?.start || ''); end.onChange(slot?.end || '');
      }}>
      <option value="">— Chọn slot —</option>
      {legacy && <option value="legacy">Giờ hiện tại · {start.value}–{end.value}</option>}
      {SESSION_SLOTS.map(slot => <option key={slot.id} value={slot.id}>{slot.label} · {slot.start}–{slot.end}</option>)}
    </Form.Select>
    {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
  </Form.Group>;
}
