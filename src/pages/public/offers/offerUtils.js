// Hàm hỗ trợ cho trang bảng gói tập công khai (/offers, /offers/:offerId).
//
// Các con số "giá mỗi tháng" và "tiết kiệm" chỉ để tham khảo, tính từ giá và
// số ngày do BE trả về; giá thanh toán thật luôn là priceAmount của Offer.

import {
  getMembershipBenefitState,
  groupMembershipBenefits,
} from '../../../utils/membershipBenefits';

// Chỉ hiển thị trên trang công khai những gói có mô tả tối thiểu 3 ký tự.
// Gói chưa nhập mô tả (hoặc chỉ gõ 1-2 ký tự thử) coi như chưa hoàn thiện nên
// không đưa cho khách xem. Đây là bộ lọc hiển thị; muốn gói hiện lên thì nhập
// mô tả cho gói đó ở trang quản lý gói tập.
export const MIN_DESCRIPTION_LENGTH = 3;

export function isDisplayableOffer(offer) {
  return (offer?.description ?? '').trim().length >= MIN_DESCRIPTION_LENGTH;
}

// 30 -> "1 tháng", 90 -> "3 tháng", 365 -> "1 năm", còn lại -> "N ngày".
export function formatDuration(days) {
  const d = Number(days);
  if (!d) return '—';
  if (d % 365 === 0) return `${d / 365} năm`;
  if (d % 30 === 0) return `${d / 30} tháng`;
  return `${d} ngày`;
}

// Giá quy ra 30 ngày, làm tròn đến đồng.
export function pricePerMonth(offer) {
  const price = Number(offer?.priceAmount);
  const days = Number(offer?.durationDays);
  if (!price || !days) return null;
  return Math.round((price / days) * 30);
}

// So mỗi Offer với Offer có thời hạn NGẮN NHẤT cùng loại gói để
// biết mua dài hạn rẻ hơn bao nhiêu %. Trả về Map offerId -> { perMonth, savings }.
export function computeOfferPricing(offers) {
  const baseByPlan = new Map();
  for (const o of offers) {
    const prev = baseByPlan.get(o.planCode);
    if (!prev || Number(o.durationDays) < Number(prev.durationDays)) {
      baseByPlan.set(o.planCode, o);
    }
  }
  const out = new Map();
  for (const o of offers) {
    const perMonth = pricePerMonth(o);
    const base = pricePerMonth(baseByPlan.get(o.planCode));
    let savings = 0;
    if (perMonth && base && perMonth < base) {
      savings = Math.round((1 - perMonth / base) * 100);
    }
    out.set(o.offerId, { perMonth, savings });
  }
  return out;
}

// Offer có % tiết kiệm lớn nhất (để gắn nhãn "Tiết kiệm nhất"); null nếu
// không Offer nào rẻ hơn bản thời hạn ngắn.
export function findBestSavingsOfferId(pricing) {
  let bestId = null;
  let best = 0;
  for (const [id, info] of pricing) {
    if (info.savings > best) {
      best = info.savings;
      bestId = id;
    }
  }
  return bestId;
}

// Contract mới dùng danh sách Benefit động. Hai capability cũ chỉ là fallback
// khi response cũ hoàn toàn chưa có `benefitCodes` và `benefits`.
export function buildFeatures(offer) {
  const benefitState = getMembershipBenefitState(offer);
  if (benefitState.known) {
    return groupMembershipBenefits(offer).map((item) => ({
      code: item.key,
      ok: item.status !== 'INACTIVE',
      text: item.displayName,
      status: item.status,
      kind: item.kind,
      children:
        item.kind === 'group'
          ? item.benefits.map((benefit) => ({
              code: benefit.code,
              text: benefit.displayName,
            }))
          : [],
    }));
  }

  return [
    {
      code: 'CLASS_BOOKING',
      ok: Boolean(offer?.supportsBooking),
      text: offer?.supportsBooking
        ? 'Có quyền đặt lớp trực tuyến'
        : 'Chưa gồm quyền đặt lớp trực tuyến',
    },
    {
      code: 'PERSONAL_COACHING',
      ok: Boolean(offer?.supportsPersonalCoaching),
      text: offer?.supportsPersonalCoaching
        ? 'Có quyền huấn luyện viên cá nhân'
        : 'Chưa gồm quyền huấn luyện viên cá nhân',
    },
  ];
}
