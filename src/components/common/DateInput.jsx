import { forwardRef, useEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useController } from 'react-hook-form';

import {
  formatDateInput,
  parseDateInput,
  resolveDateInputValue,
} from '../../utils/dateInput';
import './DateInput.css';

const NO_EMISSION = Symbol('no-emission');

export const DateInput = forwardRef(function DateInput(
  {
    value = '',
    onChange,
    onBlur,
    min,
    max,
    isInvalid = false,
    size,
    className = '',
    unstyled = false,
    emitInvalid = false,
    ...props
  },
  ref,
) {
  const [displayValue, setDisplayValue] = useState(() =>
    formatDateInput(value) || String(value ?? ''),
  );
  const lastEmission = useRef(NO_EMISSION);
  const isComposing = useRef(false);

  useEffect(() => {
    if (lastEmission.current === value) {
      lastEmission.current = NO_EMISSION;
      return;
    }
    setDisplayValue(formatDateInput(value) || String(value ?? ''));
  }, [value]);

  const commit = (nextDisplayValue) => {
    const nextValue = resolveDateInputValue(
      nextDisplayValue,
      min,
      max,
      emitInvalid,
    );
    lastEmission.current = nextValue;
    onChange?.(nextValue);
    return nextValue;
  };

  const updateDraft = (rawValue) => {
    setDisplayValue(rawValue);
    commit(rawValue);
  };

  const sharedProps = {
    ...props,
    ref,
    type: 'text',
    inputMode: 'numeric',
    placeholder: 'dd/mm/yyyy',
    maxLength: 10,
    value: displayValue,
    'aria-invalid': props['aria-invalid'] ?? (isInvalid || undefined),
    onCompositionStart: () => {
      isComposing.current = true;
    },
    onCompositionEnd: (event) => {
      isComposing.current = false;
      const input = event.target;
      updateDraft(input.value);
    },
    onChange: (event) => {
      const input = event.target;
      if (isComposing.current || event.nativeEvent?.isComposing) {
        setDisplayValue(input.value);
        return;
      }
      const rawValue = input.value;
      updateDraft(rawValue);
    },
    onBlur: (event) => {
      const nextValue = commit(event.target.value);
      const formatted = formatDateInput(nextValue);
      if (formatted) setDisplayValue(formatted);
      onBlur?.(event);
    },
  };

  const input = unstyled ? (
    <input {...sharedProps} className={[isInvalid && 'is-invalid', className].filter(Boolean).join(' ')} />
  ) : (
    <Form.Control
      {...sharedProps}
      className={className || undefined}
      size={size}
      isInvalid={isInvalid}
    />
  );
  return <div className={`scms-date-input${isInvalid ? ' is-invalid' : ''}`}>
    {input}
    <span className="scms-date-picker">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
      <input
        type="date"
        aria-label={`Chọn ngày trên lịch${props['aria-label'] ? `: ${props['aria-label']}` : ''}`}
        value={parseDateInput(displayValue) || ''}
        min={min}
        max={max}
        disabled={props.disabled || props.readOnly}
        onClick={event => event.currentTarget.showPicker?.()}
        onChange={event => {
          const formatted = formatDateInput(event.target.value);
          setDisplayValue(formatted);
          commit(formatted);
        }}
        onBlur={onBlur}
      />
    </span>
  </div>;
});

export function RhfDateInput({ control, name, rules, ...props }) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
  } = useController({ control, name, rules });
  return (
    <DateInput
      {...props}
      ref={ref}
      name={fieldName}
      value={value ?? ''}
      onChange={onChange}
      onBlur={onBlur}
      emitInvalid
    />
  );
}
