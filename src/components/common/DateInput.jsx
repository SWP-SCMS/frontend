import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useController } from 'react-hook-form';

import {
  formatDateInput,
  normalizeDateInputDraft,
  resolveDateInputValue,
} from '../../utils/dateInput';

const NO_EMISSION = Symbol('no-emission');

function caretAfterDigits(value, digitCount) {
  if (digitCount <= 0) return 0;
  let digits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) digits += 1;
    if (digits === digitCount) return index + 1;
  }
  return value.length;
}

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
  const pendingCaret = useRef(null);
  const isComposing = useRef(false);

  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pendingCaret.current = null;
    if (document.activeElement === pending.input) {
      pending.input.setSelectionRange(pending.position, pending.position);
    }
  }, [displayValue]);

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

  const updateDraft = (input, rawValue, caret) => {
    const digitsBeforeCaret = rawValue.slice(0, caret).replace(/\D/g, '').length;
    const nextValue = normalizeDateInputDraft(rawValue);
    const nextCaret = caretAfterDigits(nextValue, digitsBeforeCaret);
    if (nextValue === displayValue) {
      input.setSelectionRange(nextCaret, nextCaret);
    } else {
      pendingCaret.current = { input, position: nextCaret };
    }
    setDisplayValue(nextValue);
    commit(nextValue);
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
      updateDraft(input, input.value, input.selectionStart ?? input.value.length);
    },
    onChange: (event) => {
      const input = event.target;
      if (isComposing.current || event.nativeEvent?.isComposing) {
        setDisplayValue(input.value);
        return;
      }
      const rawValue = input.value;
      const caret = input.selectionStart ?? rawValue.length;
      updateDraft(input, rawValue, caret);
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
