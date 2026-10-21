// Khung giao diện cho khu vực Hội viên: sidebar tối bên trái, header phía
// trên, nội dung sáng ở giữa. Không dùng AppShell vì AppShell còn dùng chung
// cho Lễ tân / HLV / Quản lý.
//
// Layout tải danh sách Membership của Member 1 lần và chia sẻ qua
// MemberAreaContext (sidebar và Dashboard cùng dùng).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/useAuth';
import {
  getMyMemberships,
  listActiveOffers,
} from '../../services/membershipService';
import { getMembershipBenefitState } from '../../utils/membershipBenefits';
import { MemberAreaContext } from './MemberAreaContext';
import MemberSidebar from './MemberSidebar';
import MemberHeader from './MemberHeader';
import { MEMBER_SIDEBAR_ITEMS } from './navConfig';
import useNotificationUnreadCount from './useNotificationUnreadCount';
import './MemberLayout.css';

export default function MemberLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [memberships, setMemberships] = useState([]);
  const [activeOffers, setActiveOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unreadCount = useNotificationUnreadCount();

  // Hộp thoại xác nhận trước khi đăng xuất.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [benefitNoticeFor, setBenefitNoticeFor] = useState(null);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMemberships(await getMyMemberships());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  useEffect(() => {
    let cancelled = false;
    listActiveOffers()
      .then((offers) => {
        if (!cancelled) setActiveOffers(offers);
      })
      .catch(() => {
        if (!cancelled) setActiveOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // BR-MEM-04/05: Membership hết hạn chuyển sang EXPIRED và không dùng lại.
  // Chỉ Membership ACTIVE mới được coi là "đang có gói".
  const activeMembership = useMemo(
    () => memberships.find((m) => m.status === 'ACTIVE') || null,
    [memberships],
  );

  // Contract Membership cũ chưa có Benefit. Khi BE trả benefitCodes, UI gate
  // chính xác theo quyền; khi chưa có thì không khóa oan và để BE xác nhận
  // mutation. Tuyệt đối không suy quyền từ mã/tên Plan.
  const rawBenefitCodes =
    activeMembership?.benefitCodes ?? activeMembership?.benefit_codes;
  const benefitsKnown = Array.isArray(rawBenefitCodes);
  const benefitCodes = useMemo(
    () => (benefitsKnown ? rawBenefitCodes : []),
    [benefitsKnown, rawBenefitCodes],
  );
  const hasBenefit = useCallback(
    (benefitCode) => benefitCodes.includes(benefitCode),
    [benefitCodes],
  );
  const isBenefitLocked = useCallback(
    (benefitCode) =>
      Boolean(benefitCode) &&
      !loading &&
      !error &&
      benefitsKnown &&
      !hasBenefit(benefitCode),
    [benefitsKnown, error, hasBenefit, loading],
  );

  // Hiển thị tên gói tối thiểu đang mở bán có Benefit tương ứng. Thông tin
  // được suy ra từ contract Offer động, không ghi cứng Benefit -> Plan.
  const requiredPlanByBenefit = useMemo(() => {
    const planRank = { BASIC: 0, PLUS: 1, PREMIUM: 2 };
    const candidates = [...activeOffers].sort((left, right) => {
      const leftCode = String(left.planCode || '').toUpperCase();
      const rightCode = String(right.planCode || '').toUpperCase();
      const rankDifference =
        (planRank[leftCode] ?? Number.MAX_SAFE_INTEGER) -
        (planRank[rightCode] ?? Number.MAX_SAFE_INTEGER);
      if (rankDifference !== 0) return rankDifference;
      return Number(left.priceAmount || 0) - Number(right.priceAmount || 0);
    });

    const labels = new Map();
    candidates.forEach((offer) => {
      const label = offer.planDisplayName || offer.planCode;
      if (!label) return;
      getMembershipBenefitState(offer).benefitCodes.forEach((code) => {
        if (!labels.has(code)) labels.set(code, label);
      });
    });
    return labels;
  }, [activeOffers]);

  const getRequiredPlanLabel = useCallback(
    (benefitCode) => requiredPlanByBenefit.get(benefitCode) || null,
    [requiredPlanByBenefit],
  );

  const areaValue = useMemo(
    () => ({
      memberships,
      activeMembership,
      hasActiveMembership: activeMembership != null,
      benefitCodes,
      benefitsKnown,
      hasBenefit,
      isBenefitLocked,
      getRequiredPlanLabel,
      loading,
      error,
      reload: loadMemberships,
    }),
    [
      memberships,
      activeMembership,
      benefitCodes,
      benefitsKnown,
      hasBenefit,
      isBenefitLocked,
      getRequiredPlanLabel,
      loading,
      error,
      loadMemberships,
    ],
  );

  // Chỉ đăng xuất sau khi người dùng bấm "Đăng xuất" trong hộp thoại xác nhận.
  async function handleConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  // Dòng trạng thái ở thẻ thành viên (góc dưới sidebar).
  let statusText = 'Đang tải...';
  if (!loading && error) statusText = 'Không tải được gói tập';
  else if (!loading && activeMembership) {
    const plan = activeMembership.plan_code_snapshot || activeMembership.planCode;
    statusText = plan ? `Gói ${plan} đang hoạt động` : 'Đang có gói tập';
  } else if (!loading) statusText = 'Chưa kích hoạt gói tập';

  const requestLogout = () => setConfirmOpen(true);

  return (
    <MemberAreaContext.Provider value={areaValue}>
      <div className="scms-ml">
        <MemberSidebar
          user={user}
          activeMembership={activeMembership}
          statusText={statusText}
          items={MEMBER_SIDEBAR_ITEMS}
          isBenefitLocked={isBenefitLocked}
          getRequiredPlanLabel={getRequiredPlanLabel}
          onLockedClick={setBenefitNoticeFor}
          onRequestLogout={requestLogout}
        />

        <div className="scms-ml-body">
          <MemberHeader
            user={user}
            unreadCount={unreadCount}
            onRequestLogout={requestLogout}
          />

          <main className="scms-ml-main">{children}</main>
        </div>

        <Modal
          show={benefitNoticeFor != null}
          onHide={() => setBenefitNoticeFor(null)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title className="h5">Tính năng chưa có trong gói</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Gói tập hiện tại chưa bao gồm tính năng &quot;
            {benefitNoticeFor?.label}&quot;.
            {getRequiredPlanLabel(benefitNoticeFor?.requiredBenefit)
              ? ` Tính năng này có trong gói ${getRequiredPlanLabel(
                  benefitNoticeFor.requiredBenefit,
                )}.`
              : ''}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setBenefitNoticeFor(null)}
            >
              Đóng
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setBenefitNoticeFor(null);
                navigate('/member/plan');
              }}
            >
              Xem các gói tập
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={confirmOpen}
          onHide={() => (loggingOut ? null : setConfirmOpen(false))}
          centered
        >
          <Modal.Header closeButton={!loggingOut}>
            <Modal.Title className="h5">Xác nhận đăng xuất</Modal.Title>
          </Modal.Header>
          <Modal.Body>Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?</Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={loggingOut}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </MemberAreaContext.Provider>
  );
}
