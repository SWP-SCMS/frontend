import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUND_REFRESH_MS, createPollingTask } from './backgroundPolling.js';

function clock() {
  let time = 0;
  let next = 0;
  const timers = new Map();
  return {
    timers,
    now: () => time,
    setTimer: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimer: id => timers.delete(id),
    async advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); }
      await Promise.resolve(); await Promise.resolve();
    },
  };
}

test('polls after seven seconds and never overlaps a slow batch or focus event', async () => {
  const fake = clock();
  let calls = 0, finish;
  const polling = createPollingTask(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, fake);
  assert.equal(BACKGROUND_REFRESH_MS, 7000);
  await fake.advance(6999); assert.equal(calls, 0);
  await fake.advance(1); assert.equal(calls, 1);
  await fake.advance(21000); await polling.run(); assert.equal(calls, 1);
  finish(); await Promise.resolve(); await Promise.resolve();
  await fake.advance(6999); assert.equal(calls, 1);
  await fake.advance(1); assert.equal(calls, 2);
  polling.dispose(); finish();
});

test('hidden/offline/disabled views pause, returning to the view refreshes once', async () => {
  const fake = clock(); let visible = false, calls = 0;
  const polling = createPollingTask(() => { calls++; }, { ...fake, canRun: () => visible });
  await fake.advance(21000); assert.equal(calls, 0);
  visible = true; await polling.run(); assert.equal(calls, 1);
  await polling.run(); assert.equal(calls, 1);
  polling.dispose(); await fake.advance(7000); assert.equal(calls, 1);
});

test('failures back off and a successful retry restores the seven second interval', async () => {
  const fake = clock(); let fail = true, calls = 0;
  const polling = createPollingTask(() => { calls++; if (fail) throw Error('offline'); }, fake);
  await fake.advance(7000); assert.equal(calls, 1);
  await fake.advance(7000); assert.equal(calls, 1);
  fail = false; await fake.advance(7000); assert.equal(calls, 2);
  await fake.advance(7000); assert.equal(calls, 3);
  polling.dispose();
});

test('dispose aborts the context and a late response cannot restart the polling loop', async () => {
  const fake = clock(); let finish, signal;
  const polling = createPollingTask(context => { signal = context.signal; return new Promise(resolve => { finish = resolve; }); }, fake);
  await fake.advance(7000); polling.dispose();
  assert.equal(signal.aborted, true);
  finish(); await Promise.resolve(); await Promise.resolve();
  assert.equal(fake.timers.size, 0);
});
