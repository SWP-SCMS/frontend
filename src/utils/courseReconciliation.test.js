import test from 'node:test';
import assert from 'node:assert/strict';
import { courseReconciliationSchema as schema } from '../schemas/courseReconciliationSchemas.js';
const paid = { status: 'PAID', receivedAmount: '1000', transferContent: 'COR-QA', providerTransactionId: 'QA-TX', evidence: 'QA evidence', reason: 'QA match' };
test('Course reconciliation requires positive safe integer money and bank evidence', () => {
  assert.equal(schema.parse(paid).receivedAmount, 1000);
  for (const receivedAmount of ['0', '-1', '1.5', '1e3', '9007199254740992', ''])
    assert.equal(schema.safeParse({ ...paid, receivedAmount }).success, false);
  for (const field of ['transferContent', 'providerTransactionId', 'evidence', 'reason'])
    assert.equal(schema.safeParse({ ...paid, [field]: '  ' }).success, false);
});
test('Failed Course decision sends only reason and evidence, not hidden bank fields', () => {
  assert.deepEqual(schema.parse({ ...paid, status: 'FAILED', receivedAmount: 'invalid' }),
    { status: 'FAILED', evidence: 'QA evidence', reason: 'QA match' });
});
test('Course reconciliation enforces backend text limits and status enum', () => {
  for (const [field, max] of [['transferContent', 200], ['providerTransactionId', 100], ['evidence', 4000], ['reason', 2000]]) {
    assert.equal(schema.safeParse({ ...paid, [field]: 'a'.repeat(max) }).success, true);
    assert.equal(schema.safeParse({ ...paid, [field]: 'a'.repeat(max + 1) }).success, false);
  }
  assert.equal(schema.safeParse({ ...paid, status: 'EXPIRED' }).success, false);
});
