import { useState } from 'react';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { getMyPendingMembershipOrder } from '../../../services/memberService';
import ErrorAlert from '../../../components/common/ErrorAlert';
import MemberOfferSection from './MemberOfferSection';

export default function MemberPlanRegistrationPage() {
  const { reservedMembership, loading, error } = useMemberArea();
  const [pendingOrder, setPendingOrder] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  usePollingEffect(({ background, track, commitValue, failed }) => {
    let cancelled = false;
    track(getMyPendingMembershipOrder()
      .then((order) => {
        if (!cancelled) commitValue(setPendingOrder, order);
      })
      .catch(() => { failed();
        // BE vẫn kiểm tra khi tạo đơn; lỗi đọc đơn chờ không nên khóa cả trang.
      })
      .finally(() => {
        if (!cancelled) if (!background) commitValue(setPendingLoading, false);
      }));
    return () => {
      cancelled = true;
    };
  }, []);


  if (loading) return <p>Đang tải gói tập…</p>;
  if (error) return <ErrorAlert error={error} title="Không tải được thông tin gói tập" />;
  return <div className="member-plan-registration">
      {/* ACTIVE vẫn được mua một lần để gia hạn. Chỉ khóa khi đã có gói chờ
          kích hoạt hoặc còn một đơn chờ thanh toán. */}
      <MemberOfferSection
        blockedReason={
          reservedMembership
            ? 'Bạn đã có một gói gia hạn đang chờ kích hoạt. Bạn chỉ có thể mua tiếp sau khi gói đó được kích hoạt.'
            : pendingOrder
              ? `Bạn đang có đơn ${pendingOrder.orderNumber} chờ thanh toán. Hãy hoàn tất đơn đó trước.`
              : pendingLoading
                ? 'Đang kiểm tra đơn chờ thanh toán...'
                : null
        }
      />
  </div>;
}
