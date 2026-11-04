import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearQueryCache, queryCacheGeneration, readQueryCache, writeQueryCache } from './queryCache.js';

test('cache isolates account/filter/page keys and clones snapshots', () => {
  clearQueryCache();
  const key = JSON.stringify(['MEMBER', 'a', ['results', 0]]);
  const rows = [{ name: 'original' }];
  writeQueryCache(key, rows, queryCacheGeneration());
  rows[0].name = 'mutated';
  const read = readQueryCache(key);
  assert.equal(read[0].name, 'original');
  read[0].name = 'edited form';
  assert.equal(readQueryCache(key)[0].name, 'original');
  assert.equal(readQueryCache(JSON.stringify(['MEMBER', 'b', ['results', 0]])), undefined);
  assert.equal(readQueryCache(JSON.stringify(['MEMBER', 'a', ['results', 1]])), undefined);
});
test('logout or successful write invalidates snapshots and rejects older requests', () => {
  clearQueryCache();
  const generation = queryCacheGeneration();
  writeQueryCache('a', [], generation);
  assert.deepEqual(readQueryCache('a'), []);
  clearQueryCache();
  writeQueryCache('a', ['late'], generation);
  assert.equal(readQueryCache('a'), undefined);
});
test('cache expires after five minutes and limits memory entries', context => {
  context.mock.timers.enable({ apis: ['Date'], now: 1000 });
  clearQueryCache();
  for (let i = 0; i < 101; i++) writeQueryCache(String(i), i, queryCacheGeneration());
  assert.equal(readQueryCache('0'), undefined);
  assert.equal(readQueryCache('100'), 100);
  context.mock.timers.tick(300001);
  assert.equal(readQueryCache('100'), undefined);
});
