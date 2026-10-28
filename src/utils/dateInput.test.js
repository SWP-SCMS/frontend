import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDateInput,
  normalizeDateInputDraft,
  parseDateInput,
  resolveDateInputValue,
} from './dateInput.js';

test('formats ISO dates for Vietnamese date inputs', () => {
  assert.equal(formatDateInput('2026-10-28'), '28/10/2026');
  assert.equal(formatDateInput(''), '');
});

test('parses valid Vietnamese dates to the API format', () => {
  assert.equal(parseDateInput('28/10/2026'), '2026-10-28');
  assert.equal(parseDateInput('29/02/2028'), '2028-02-29');
  assert.equal(parseDateInput(''), '');
});

test('rejects invalid calendar dates', () => {
  assert.equal(parseDateInput('31/02/2026'), null);
  assert.equal(parseDateInput('29/02/2026'), null);
  assert.equal(parseDateInput('2026-10-28'), null);
});

test('inserts separators for numeric and mobile input', () => {
  assert.equal(normalizeDateInputDraft('2'), '2');
  assert.equal(normalizeDateInputDraft('2810'), '28/10');
  assert.equal(normalizeDateInputDraft('28102026'), '28/10/2026');
  assert.equal(normalizeDateInputDraft('28/10/2026'), '28/10/2026');
});

test('resolves model values without submitting stale or out-of-range dates', () => {
  assert.equal(resolveDateInputValue('28/10/2026'), '2026-10-28');
  assert.equal(resolveDateInputValue('31/02/2026'), '');
  assert.equal(
    resolveDateInputValue('28/10/2026', '2026-10-29', undefined),
    '',
  );
  assert.equal(
    resolveDateInputValue('31/02/2026', undefined, undefined, true),
    '31/02/2026',
  );
});
