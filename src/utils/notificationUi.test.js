import assert from 'node:assert/strict';
import test from 'node:test';

import {
  notificationSummary,
} from './notificationUi.js';

const activationNotification = {
  notificationType: 'MANUAL_ACTIVATION_REVIEW_REQUIRED',
  targetType: 'MANUAL_ACTIVATION_REQUEST',
  targetId: 'request-id',
  payload: {},
};

test('labels manual activation review notifications in Vietnamese', () => {
  assert.equal(
    notificationSummary(activationNotification),
    'Có yêu cầu kích hoạt tài khoản cần duyệt',
  );
});
