import { forwardRef, useEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useController } from 'react-hook-form';

import {
  formatDateInput,
  normalizeDateInputDraft,
  resolveDateInputValue,
} from '../../utils/dateInput';

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
    formatDateInput(value) || normalizeDateInputDraft(value),
  );
  const lastEmission = useRef(NO_EMISSION);

  useEffect(() => {
    if (lastEmission.current === value) {
      lastEmission.current = NO_EMISSION;
      return;
    }
    setDisplayValue(formatDateInput(value) || normalizeDateInputDraft(value));
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

  const sharedProps = {
    ...props,
    ref,
    type: 'text',
    inputMode: 'numeric',
    placeholder: 'dd/mm/yyyy',
    maxLength: 10,
    value: displayValue,
    'aria-invalid': props['aria-invalid'] ?? (isInvalid || undefined),
    onChange: (event) => {
      const nextValue = normalizeDateInputDraft(event.target.value);
      setDisplayValue(nextValue);
      commit(nextValue);
    },
    onBlur: (event) => {
      const nextValue = commit(event.target.value);
      if (!emitInvalid && nextValue === '') setDisplayValue('');
      onBlur?.(event);
    },
  };

  if (unstyled) {
    const classes = [isInvalid && 'is-invalid', className]
      .filter(Boolean)
      .join(' ');
    return <input {...sharedProps} className={classes || undefined} />;
  }
  return (
    <Form.Control
      {...sharedProps}
      className={className || undefined}
      size={size}
      isInvalid={isInvalid}
    />
  );
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
