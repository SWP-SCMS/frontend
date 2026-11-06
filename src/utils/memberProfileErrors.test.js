import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeMemberProfileError } from './memberProfileErrors.js';
import { applyServerErrors } from './serverErrors.js';

const validation = errors => ({ response: { status: 400, data: { code: 'VALIDATION_ERROR', errors } } });
test('profile validation messages are localized and emergency pair maps to visible phone field', () => {
  const error = localizeMemberProfileError(validation({
    gender: ['must be MALE, FEMALE or null'],
    address: ['must not exceed 500 characters'],
    physicalConditionNotes: ['must be null or non-blank'],
    emergencyContact: ['name and phone must both be provided or both be null'],
  }));
  const shown = {};
  assert.equal(applyServerErrors(error, (field, value) => { shown[field] = value.message; },
    { fields: ['gender', 'address', 'physicalConditionNotes', 'emergencyContactPhone'] }), true);
  assert.match(shown.gender, /Nam hoặc Nữ/);
  assert.match(shown.address, /500 ký tự/);
  assert.match(shown.physicalConditionNotes, /khoảng trắng/);
  assert.match(shown.emergencyContactPhone, /cả họ tên và số điện thoại/);
  assert.doesNotMatch(error.message, /must|MALE|FEMALE|characters/);
});
test('unknown messages, hidden fields and HTTP failures never expose raw backend text', () => {
  for (const error of [validation({ address: 'unknown English error SQL', profileImageUrl: 'internal path', hidden: [] }),
    { response: { status: 500, data: { detail: 'SQL stack', errors: { address: ['secret'] } } } },
    { response: { status: 400, data: { detail: 'Malformed raw request' } } },
    { isAxiosError: true, message: 'Network Error' }]) {
    assert.doesNotMatch(localizeMemberProfileError(error).message, /English|SQL|stack|secret|Malformed|Network Error|internal path/);
  }
});
test('existing phone conflict localization is preserved', () => {
  const error = localizeMemberProfileError({ response: { status: 409, data: { code: 'PHONE_ALREADY_EXISTS' } } });
  let shown;
  assert.equal(applyServerErrors(error, (_, value) => { shown = value.message; }, { fields: ['phone'] }), true);
  assert.match(shown, /Số điện thoại.*sử dụng/);
});
