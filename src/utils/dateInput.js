const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatDateInput(value) {
  if (!value) return '';
  const match = ISO_DATE.exec(value);
  if (!match) return '';
  const [, year, month, day] = match;
  if (!isCalendarDate(Number(year), Number(month), Number(day))) return '';
  return `${day}/${month}/${year}`;
}

export function parseDateInput(value) {
  if (!value) return '';
  const match = DISPLAY_DATE.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  if (!isCalendarDate(Number(year), Number(month), Number(day))) return null;
  return `${year}-${month}-${day}`;
}

export function normalizeDateInputDraft(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function resolveDateInputValue(value, min, max, preserveInvalid = false) {
  const parsed = parseDateInput(value);
  if (
    parsed === '' ||
    (parsed && (!min || parsed >= min) && (!max || parsed <= max))
  ) {
    return parsed;
  }
  return preserveInvalid ? value : '';
}
