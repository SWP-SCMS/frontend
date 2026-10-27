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
          displayOrder: 2,
          groupCode: ' scheduling ',
          groupDisplayName: ' Lịch tập ',
          groupDisplayOrder: 1,
        },
      ],
    }),
    [
      {
        code: 'CLASS_BOOKING',
        displayName: 'Đặt lịch lớp học',
        description: 'Cho phép đặt lớp',
        status: 'ACTIVE',
        displayOrder: 2,
        groupCode: 'SCHEDULING',
        groupDisplayName: 'Lịch tập',
        groupDisplayOrder: 1,
      },
      {
        code: 'POOL_ACCESS',
        displayName: 'Sử dụng hồ bơi',
        description: null,
        status: null,
        displayOrder: null,
        groupCode: null,
        groupDisplayName: null,
        groupDisplayOrder: null,
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

