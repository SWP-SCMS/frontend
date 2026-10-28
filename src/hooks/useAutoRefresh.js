import { useEffect, useRef } from 'react';

export default function useAutoRefresh(refresh, intervalMs = 30_000, enabled = true) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible' || inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(refreshRef.current())
        .catch(() => {})
        .finally(() => {
          inFlightRef.current = false;
        });
    };
    const intervalId = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [enabled, intervalMs]);
}
