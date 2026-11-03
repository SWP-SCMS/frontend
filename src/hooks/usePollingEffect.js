import { useEffect, useRef } from 'react';
import { createPollingTask } from '../utils/backgroundPolling';

// For read effects: track every request batch, keep its existing cleanup, and
// guard writes against navigation/unmount. Background work must not reset forms.
export default function usePollingEffect(setup, dependencies, enabled = true) {
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  useEffect(() => {
    if (enabledRef.current !== enabled) generationRef.current++;
    enabledRef.current = enabled;
  });
  useEffect(() => {
    let cleanup;
    let current = true;
    const errors = new Map();
    const polling = createPollingTask(async ({ background, signal }) => {
      const generation = generationRef.current;
      const valid = () => current && !signal.aborted && generation === generationRef.current;
      cleanup?.();
      const pending = [];
      let failure;
      const context = {
        background,
        signal,
        commitValue: (setter, value) => {
          if (valid() && (!background || enabledRef.current)) setter(value);
        },
        commitError: (setter, value) => {
          if (!valid()) return;
          if (background) return; // Clear only errors owned by this read on success below.
          setter(value);
          errors.set(setter, value);
        },
        failed: error => { failure = error || new Error('Background request failed'); },
        track: promise => { pending.push(Promise.resolve(promise)); },
      };
      cleanup = setup(context);
      const results = await Promise.allSettled(pending);
      if (failure || results.some(result => result.status === 'rejected')) throw failure || new Error('Request failed');
      if (valid()) {
        for (const [setter, previous] of errors) {
          if (previous) setter(value => value === previous ? null : value);
        }
        errors.clear();
      }
    }, {
      canRun: () => enabledRef.current && document.visibilityState === 'visible' && navigator.onLine !== false,
    });
    void polling.run(true);
    const resume = () => { void polling.run(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      current = false;
      polling.dispose();
      cleanup?.();
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
    // Dependency keys are supplied by each read effect, just like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
