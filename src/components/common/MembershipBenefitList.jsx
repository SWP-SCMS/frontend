import { normalizeMembershipBenefits } from '../../utils/membershipBenefits';

export default function MembershipBenefitList({
  benefitCodes = [],
  benefits = [],
  emptyMessage = 'Chưa có quyền lợi được cấu hình.',
  showDescription = false,
}) {
  const normalized = normalizeMembershipBenefits({ benefitCodes, benefits });

  if (normalized.length === 0) {
    return <p className="mb-0 text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="list-unstyled mb-0 d-grid gap-2">
      {normalized.map((benefit) => {
        const inactive = benefit.status === 'INACTIVE';
        return (
          <li
            key={benefit.code}
            className={`d-flex align-items-start gap-2${
              inactive ? ' text-muted' : ''
            }`}
          >
            <span
              className={inactive ? 'text-secondary' : 'text-success'}
              aria-hidden="true"
            >
              {inactive ? '○' : '✓'}
            </span>
            <span>
              <span>{benefit.displayName}</span>
              {inactive ? (
                <span className="badge text-bg-secondary ms-2">
                  Ngừng áp dụng
                </span>
              ) : null}
              {showDescription && benefit.description ? (
                <small className="d-block text-muted mt-1">
                  {benefit.description}
                </small>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

