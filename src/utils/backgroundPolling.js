export const BACKGROUND_REFRESH_MS = 7_000;

// One request batch at a time. The next delay starts after the batch settles.
export function createPollingTask(task, {
  interval = BACKGROUND_REFRESH_MS,
  canRun = () => true,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
} = {}) {
  let disposed = false;
  let running = false;
  let timer;
  let failures = 0;
  let lastStarted = -Infinity;
  const controller = new AbortController();
  const schedule = () => {
    clearTimer(timer);
    if (!disposed) timer = setTimer(() => run(), Math.min(interval * 2 ** failures, 60_000));
  };
  async function run(initial = false) {
    if (disposed || running) return;
    if (!initial && (!canRun() || now() - lastStarted < 500)) { schedule(); return; }
    clearTimer(timer);
    running = true;
    lastStarted = now();
    try {
      await task({ background: !initial, signal: controller.signal });
      failures = 0;
    } catch {
      failures = Math.min(failures + 1, 4);
    } finally {
      running = false;
      schedule();
    }
  }
  schedule();
  return {
    run,
    dispose() { disposed = true; controller.abort(); clearTimer(timer); },
  };
}
