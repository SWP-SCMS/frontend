import assert from 'node:assert/strict';
import test from 'node:test';

import {
  manualActivationNotificationDestination,
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

test('routes manual activation review notifications only for managers', () => {
  assert.equal(
    manualActivationNotificationDestination(activationNotification, '/manager/notifications'),
    '/manager/email-verification',
  );
  assert.notEqual(
    manualActivationNotificationDestination(activationNotification, '/reception/notifications'),
    '/manager/email-verification',
  );
  assert.notEqual(
    manualActivationNotificationDestination(activationNotification, '/member/notifications'),
    '/manager/email-verification',
  );
});

test('routes read notifications and tolerates missing optional payload fields', () => {
  assert.equal(
    manualActivationNotificationDestination(
      { ...activationNotification, read: true, payload: undefined },
      '/manager/notifications',
    ),
    '/manager/email-verification',
  );
});
