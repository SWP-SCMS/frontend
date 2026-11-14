import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useCourseResourceAvailability({ windows, capacity, excludeSessionId, excludeSessionIds, enabled = true }) {
  const valid = enabled && windows.length > 0 && Number.isSafeInteger(Number(capacity)) && Number(capacity) > 0
    && windows.every(w => Number.isFinite(Date.parse(w.startAt)) && Date.parse(w.endAt) > Date.parse(w.startAt));
  const key = valid ? JSON.stringify({ windows, capacity: Number(capacity), excludeSessionId: excludeSessionId || null,
    ...(excludeSessionIds ? { excludeSessionIds } : {}),
  }) : '';
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!key) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post('/manager/course-runs/resource-availability', JSON.parse(key), { signal: abort.signal });
        if (!abort.signal.aborted) setResult({ key, data });
      } catch (error) {
        if (!abort.signal.aborted) setResult({ key, error });
      }
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [key, retry]);
  const current = key && result?.key === key ? result : null;
  return {
    ready: !!current?.data, loading: !!key && !current, error: current?.error,
    coaches: current?.data?.coaches || [], rooms: current?.data?.rooms || [],
    retry: () => { setResult(null); setRetry(value => value + 1); },
  };
}
