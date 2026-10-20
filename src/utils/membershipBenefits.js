function normalizeCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

export function formatBenefitCode(value) {
  const code = normalizeCode(value);
  if (!code) return 'Quyền lợi chưa xác định';

  const words = code.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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

  for (const benefit of rawBenefits) {
    const code = normalizeCode(benefit?.code);
    if (!code) continue;

    const displayName =
      typeof benefit.displayName === 'string' && benefit.displayName.trim()
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
    });

    if (!orderedCodes.includes(code)) orderedCodes.push(code);
  }

  return orderedCodes.map(
    (code) =>
      detailsByCode.get(code) || {
        code,
        displayName: formatBenefitCode(code),
        description: null,
        status: null,
      },
  );
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

