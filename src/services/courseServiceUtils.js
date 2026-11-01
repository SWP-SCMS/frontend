export function createCourseIdempotencyKey(prefix = 'course') {
  const value = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`.slice(0, 100);
}

export function courseIdempotencyConfig(idempotencyKey) {
  if (!idempotencyKey) return undefined;
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

export function normalizeCoursePage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length,
      totalElements: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      last: true,
    };
  }

  return {
    ...data,
    content: Array.isArray(data?.content) ? data.content : [],
    last: typeof data?.last === 'boolean' ? data.last
      : Number.isInteger(data?.totalPages) ? (data?.page || 0) + 1 >= data.totalPages : true,
  };
}
