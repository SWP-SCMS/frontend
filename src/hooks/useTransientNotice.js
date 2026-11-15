import { useCallback, useEffect, useState } from 'react';

export default function useTransientNotice(emptyValue = null) {
  const [entry, setEntry] = useState(null);
  const setNotice = useCallback((value, { persistent = false } = {}) => {
    setEntry(value ? { value, persistent } : null);
  }, []);

  useEffect(() => {
    if (!entry || entry.persistent) return undefined;
    const timer = window.setTimeout(() => {
      setEntry(current => current === entry ? null : current);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [entry]);

  return [entry?.value ?? emptyValue, setNotice];
}
