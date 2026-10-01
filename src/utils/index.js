// Small utilities that don't belong to any feature module.

// Format a price amount (number) using a currency code. Falls back to VND
// formatting when an unknown currency is provided. Returned string is for
// display only; do not parse it back to a number on the FE.
export function formatPrice(amount, currencyCode = 'VND') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);

  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Unknown currency code -> emit raw amount with the code suffix.
    return `${value.toLocaleString('vi-VN')} ${currencyCode}`;
  }
}

// Format an ISO date string (yyyy-MM-dd or full ISO) into vi-VN dd/MM/yyyy.
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format an ISO datetime into dd/MM/yyyy HH:mm.
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Normalize a Vietnamese phone string to the 10-digit form the backend
// expects (e.g. 0901234567). Returns null when the input can't be cleaned.
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;
  // Strip country prefix if user pasted +84 / 84.
  let normalized = digits;
  if (normalized.startsWith('84') && normalized.length === 11) {
    normalized = `0${normalized.slice(2)}`;
  }
  if (normalized.length !== 10 || !normalized.startsWith('0')) return null;
  return normalized;
}

// Validate a normalized 10-digit Vietnamese mobile number.
export function isValidPhone(raw) {
  return normalizePhone(raw) != null;
}

// Extract a human-readable error message from an Axios error or any thrown
// value. Backend is expected to respond with { message, code, ... }.
export function extractErrorMessage(error, fallback = 'Đã có lỗi xảy ra') {
  if (!error) return fallback;
  const data = error.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'string') return first;
      if (first?.message) return first.message;
    }
    if (data.code) return data.code;
  }
  if (error.message) return error.message;
  return fallback;
}
