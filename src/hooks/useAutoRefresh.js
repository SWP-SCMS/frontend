import { useEffect, useRef } from 'react';
import { BACKGROUND_REFRESH_MS, createPollingTask } from '../utils/backgroundPolling';

export default function useAutoRefresh(refresh, intervalMs = BACKGROUND_REFRESH_MS, enabled = true) {
  const refreshRef = useRef(refresh);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  useEffect(() => {
    if (enabledRef.current !== enabled) generationRef.current++;
    refreshRef.current = refresh;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    const polling = createPollingTask(context => {
      const refresh = refreshRef.current;
      const generation = generationRef.current;
      return refresh({ ...context, commitValue: (setter, value) => {
        if (!context.signal.aborted && enabledRef.current && refreshRef.current === refresh && generation === generationRef.current) setter(value);
      } });
    }, {
      interval: intervalMs,
      canRun: () => enabledRef.current && document.visibilityState === 'visible' && navigator.onLine !== false,
    });
    const resume = () => { void polling.run(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      polling.dispose();
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [intervalMs]);
}
