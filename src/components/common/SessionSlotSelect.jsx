import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useController } from 'react-hook-form';
import { SESSION_SLOTS } from '../../utils/sessionSlots';
export default function SessionSlotSelect({ control, startName = 'startTime', endName = 'endTime', id = 'session-slot', disabled = false }) {
  const [manual, setManual] = useState(false);
  const { field: start, fieldState: startState } = useController({ control, name: startName });
  const { field: end, fieldState: endState } = useController({ control, name: endName });
  const selected = SESSION_SLOTS.find(slot => slot.start === start.value && slot.end === end.value);
  const legacy = !selected && start.value && end.value;
  const error = startState.error?.message || endState.error?.message;
  return <fieldset disabled={disabled}>
    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
      {manual ? <span>Khung giờ *</span> : <Form.Label htmlFor={id} className="mb-0">Khung giờ *</Form.Label>}
      <Button type="button" size="sm" variant="outline-secondary" onClick={() => setManual(!manual)}>
        {manual ? 'Chọn theo slot' : 'Nhập giờ thủ công'}
      </Button>
    </div>
    {manual ? <div className="row g-2">
      {[[start, startState, 'Giờ bắt đầu'], [end, endState, 'Giờ kết thúc']].map(([field, state, label]) => (
        <Form.Group className="col-sm-6" controlId={`${id}-${field.name}`} key={field.name}>
          <Form.Label>{label} *</Form.Label>
          <Form.Control type="time" {...field} value={field.value || ''} isInvalid={!!state.error} />
          <Form.Control.Feedback type="invalid">{state.error?.message}</Form.Control.Feedback>
        </Form.Group>
      ))}
    </div> : <Form.Group controlId={id}>
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
    </Form.Group>}
  </fieldset>;
}
