import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMissingBenefitCodes,
  getMembershipBenefitState,
  normalizeMembershipBenefits,
} from './membershipBenefits.js';

test('normalizes benefit details and appends codes without details', () => {
  assert.deepEqual(
    normalizeMembershipBenefits({
      benefitCodes: ['CLASS_BOOKING', 'POOL_ACCESS', 'CLASS_BOOKING'],
      benefits: [
        {
          code: 'class_booking',
          displayName: 'Đặt lịch lớp học',
          description: ' Cho phép đặt lớp ',
          status: 'active',
        },
      ],
    }),
    [
      {
        code: 'CLASS_BOOKING',
        displayName: 'Đặt lịch lớp học',
        description: 'Cho phép đặt lớp',
        status: 'ACTIVE',
      },
      {
        code: 'POOL_ACCESS',
        displayName: 'Sử dụng hồ bơi',
        description: null,
        status: null,
      },
    ],
  );
});

test('distinguishes an empty known contract from a missing legacy contract', () => {
  assert.deepEqual(getMembershipBenefitState({ benefitCodes: [] }), {
    known: true,
    benefits: [],
    benefitCodes: [],
  });
  assert.deepEqual(getMembershipBenefitState({ supportsBooking: true }), {
    known: false,
    benefits: [],
    benefitCodes: [],
  });
});

test('finds missing benefits with normalized, stable codes', () => {
  assert.deepEqual(
    findMissingBenefitCodes(
      [' class_booking ', 'POOL_ACCESS', 'CLASS_BOOKING'],
      ['CLASS_BOOKING'],
    ),
    ['POOL_ACCESS'],
  );
});

