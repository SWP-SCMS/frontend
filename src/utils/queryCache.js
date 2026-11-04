// Cache chỉ tồn tại trong tab hiện tại. Không lưu token, form hoặc quyết định nghiệp vụ.
const entries = new Map();
const MAX_ENTRIES = 100;
const MAX_AGE_MS = 5 * 60 * 1000;
let generation = 0;

export function queryCacheGeneration() { return generation; }
export function clearQueryCache() { generation++; entries.clear(); }
export function readQueryCache(key) {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > MAX_AGE_MS) { entries.delete(key); return undefined; }
  return structuredClone(entry.value);
}
export function writeQueryCache(key, value, requestGeneration) {
  if (!key || generation !== requestGeneration) return;
  entries.delete(key);
  entries.set(key, { value: structuredClone(value), at: Date.now() });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}
