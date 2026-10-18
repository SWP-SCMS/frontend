export const MAX_MEMBERSHIP_OFFER_AMOUNT = '9999999999999999999';

export function isPositiveIntegerWithin(value, maximum) {
  if (!/^\d+$/.test(value || '')) return false;
  const normalized = value.replace(/^0+/, '') || '0';
  if (normalized === '0') return false;
  return (
    normalized.length < maximum.length ||
    (normalized.length === maximum.length && normalized <= maximum)
  );
}
