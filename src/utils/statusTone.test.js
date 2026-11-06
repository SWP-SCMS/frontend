import test from 'node:test';
import assert from 'node:assert/strict';
import { statusTone } from './statusTone.js';
test('status colors preserve financial progression and distinguish inactive from active', () => {
  assert.equal(statusTone('Đã duyệt, chưa ghi nhận chi'), 'blue');
  assert.equal(statusTone('Đã ghi nhận chi, chờ xác minh'), 'purple');
  assert.equal(statusTone('Đã xác minh hoàn tất'), 'green');
  assert.equal(statusTone('Đã công bố'), 'green');
  assert.equal(statusTone('Đã hủy'), 'neutral');
  assert.equal(statusTone('INACTIVE'), 'neutral');
  assert.equal(statusTone('ACTIVE'), 'green');
  assert.equal(statusTone('Đã từ chối'), 'red');
});
