import { groupMembershipBenefits } from '../../utils/membershipBenefits';

export default function MembershipBenefitList({
  benefitCodes = [],
  benefits = [],
  emptyMessage = 'Chưa có quyền lợi được cấu hình.',
}) {
  const items = groupMembershipBenefits({ benefitCodes, benefits });

  if (items.length === 0) {
    return <p className="mb-0 text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="list-unstyled mb-0 d-grid gap-2">
      {items.map((item) => {
        const inactive = item.status === 'INACTIVE';
        return (
          <li
            key={item.key}
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
              {item.kind === 'group' ? (
                <details>
                  <summary>
                    {item.displayName}{' '}
                    <span className="text-muted">
                      ({item.benefits.length} quyền lợi)
                    </span>
                  </summary>
                  <ul className="mt-2 mb-0 ps-3">
                    {item.benefits.map((benefit) => (
                      <li key={benefit.code}>{benefit.displayName}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <span>{item.displayName}</span>
              )}
              {inactive ? (
                <span className="badge text-bg-secondary ms-2">
                  Ngừng áp dụng
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

