function normalizeCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

const BENEFIT_DISPLAY_NAMES = {
  CENTER_ACCESS: 'Sử dụng khu tự tập luyện',
  CLASS_BOOKING: 'Đặt lịch lớp học',
  MASSAGE_ACCESS: 'Sử dụng dịch vụ massage',
  OUTDOOR_SPORT_ACCESS: 'Thể thao ngoài trời',
  PERSONAL_COACHING: 'Huấn luyện viên cá nhân',
  POOL_ACCESS: 'Sử dụng hồ bơi',
  TRAINING_FEEDBACK: 'Nhận xét luyện tập',
  TRAINING_PLAN: 'Kế hoạch luyện tập',
  TRAINING_RESULT: 'Kết quả luyện tập',
};

export function formatBenefitCode(value) {
  const code = normalizeCode(value);
  if (!code) return 'Quyền lợi chưa xác định';
  if (BENEFIT_DISPLAY_NAMES[code]) return BENEFIT_DISPLAY_NAMES[code];

  const words = code.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatBenefitCodeList(values) {
  return normalizeBenefitCodes(values).map(formatBenefitCode).join(', ');
}

export function hasBenefitContract(source) {
  return Boolean(
    source &&
      (Array.isArray(source.benefitCodes) || Array.isArray(source.benefits)),
  );
}

export function normalizeBenefitCodes(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const codes = [];
  for (const value of values) {
    const code = normalizeCode(
      typeof value === 'string' ? value : value?.code,
    );
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export function normalizeMembershipBenefits(source) {
  if (!source) return [];

  const rawBenefits = Array.isArray(source.benefits) ? source.benefits : [];
  const orderedCodes = normalizeBenefitCodes(source.benefitCodes);
  const detailsByCode = new Map();

  for (const [index, benefit] of rawBenefits.entries()) {
    const code = normalizeCode(benefit?.code);
    if (!code) continue;

    const displayName =
      code === 'CENTER_ACCESS'
        ? formatBenefitCode(code)
        : typeof benefit.displayName === 'string' && benefit.displayName.trim()
          ? benefit.displayName.trim()
          : formatBenefitCode(code);
    const description =
      typeof benefit.description === 'string' && benefit.description.trim()
        ? benefit.description.trim()
        : null;

    detailsByCode.set(code, {
      code,
      displayName,
      description,
      status:
        typeof benefit.status === 'string' && benefit.status.trim()
          ? benefit.status.trim().toUpperCase()
          : null,
      displayOrder: Number.isInteger(benefit.displayOrder)
        ? benefit.displayOrder
        : null,
      groupCode: normalizeCode(benefit.groupCode) || null,
      groupDisplayName:
        typeof benefit.groupDisplayName === 'string' &&
        benefit.groupDisplayName.trim()
          ? benefit.groupDisplayName.trim()
          : null,
      groupDisplayOrder: Number.isInteger(benefit.groupDisplayOrder)
        ? benefit.groupDisplayOrder
        : null,
      sourceIndex: index,
    });

    if (!orderedCodes.includes(code)) orderedCodes.push(code);
  }

  return orderedCodes
    .map(
    (code) =>
      detailsByCode.get(code) || {
        code,
        displayName: formatBenefitCode(code),
        description: null,
        status: null,
        displayOrder: null,
        groupCode: null,
        groupDisplayName: null,
        groupDisplayOrder: null,
        sourceIndex: orderedCodes.indexOf(code),
      },
    )
    .sort((left, right) => {
      const leftOrder = left.groupDisplayOrder ?? left.displayOrder;
      const rightOrder = right.groupDisplayOrder ?? right.displayOrder;
      if (leftOrder == null && rightOrder == null) {
        return left.sourceIndex - right.sourceIndex;
      }
      if (leftOrder == null) return 1;
      if (rightOrder == null) return -1;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (
        left.groupCode &&
        left.groupCode === right.groupCode &&
        left.displayOrder !== right.displayOrder
      ) {
        return (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
      }
      return left.code.localeCompare(right.code);
    })
    .map(({ sourceIndex: _sourceIndex, ...benefit }) => benefit);
}

export function groupMembershipBenefits(source) {
  const benefits = normalizeMembershipBenefits(source);
  const groups = new Map();

  for (const benefit of benefits) {
    if (!benefit.groupCode || !benefit.groupDisplayName) continue;
    if (!groups.has(benefit.groupCode)) groups.set(benefit.groupCode, []);
    groups.get(benefit.groupCode).push(benefit);
  }

  const emittedGroups = new Set();
  const items = [];
  for (const benefit of benefits) {
    const grouped = benefit.groupCode
      ? groups.get(benefit.groupCode) || []
      : [];
    if (grouped.length < 2) {
      items.push({
        kind: 'benefit',
        key: benefit.code,
        displayName: benefit.displayName,
        status: benefit.status,
        benefits: [benefit],
      });
      continue;
    }
    if (emittedGroups.has(benefit.groupCode)) continue;
    emittedGroups.add(benefit.groupCode);
    items.push({
      kind: 'group',
      key: `group:${benefit.groupCode}`,
      code: benefit.groupCode,
      displayName: benefit.groupDisplayName,
      status: grouped.every((item) => item.status === 'INACTIVE')
        ? 'INACTIVE'
        : 'ACTIVE',
      benefits: grouped,
    });
  }
  return items;
}

export function getMembershipBenefitState(source) {
  const known = hasBenefitContract(source);
  const benefits = known ? normalizeMembershipBenefits(source) : [];
  return {
    known,
    benefits,
    benefitCodes: benefits.map((benefit) => benefit.code),
  };
}

export function findMissingBenefitCodes(requiredValues, ownedValues) {
  const required = normalizeBenefitCodes(requiredValues);
  const owned = new Set(normalizeBenefitCodes(ownedValues));
  return required.filter((code) => !owned.has(code));
}

