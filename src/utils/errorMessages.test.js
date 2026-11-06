import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractErrorMessage } from './errorMessages.js';

test('server errors never expose technical messages or details', () => {
  for (const code of ['INTERNAL_ERROR', 'UNEXPECTED_DATABASE_ERROR']) {
    const message = extractErrorMessage({ response: { status: 500, data: { code, message: 'SQL password', detail: 'stack trace' } } });
    assert.match(message, /lỗi hệ thống/);
    assert.doesNotMatch(message, /SQL|password|stack|ERROR/);
  }
  assert.match(extractErrorMessage({ response: { status: 404, data: { code: 'MEMBER_NOT_FOUND' } } }), /hội viên/);
});
test('network errors and unknown codes are safe; localized business errors survive', () => {
  assert.match(extractErrorMessage({ isAxiosError: true, message: 'Network Error' }), /kết nối/);
  assert.equal(extractErrorMessage('SOME_NEW_CODE', 'Không thể lưu.'), 'Không thể lưu.');
  assert.equal(extractErrorMessage(new Error('Email này đã được sử dụng.')), 'Email này đã được sử dụng.');
  assert.match(extractErrorMessage({ response: { status: 403, data: {} } }), /không có quyền/);
});
