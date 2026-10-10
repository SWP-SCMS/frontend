// Tiện ích thời gian theo múi giờ phòng tập (Asia/Ho_Chi_Minh) cho các trang
// lịch lớp / đặt lớp của Hội viên.
//
// Mọi hiển thị đều đi qua múi giờ này: múi giờ của máy/trình duyệt KHÔNG được
// ảnh hưởng đến việc "hôm nay" là ngày nào hay buổi tập thuộc ngày nào.

export const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// yyyy-MM-dd (giá trị của <input type="date">).
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ngày hiện tại (YYYY-MM-DD) theo giờ phòng tập.
export function getGymZoneTodayIsoDate() {
  const now = new Date();
  if (Number.isNaN(now.getTime())) return '';
  // en-CA cho ra đúng dạng YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Ngày (YYYY-MM-DD) theo giờ phòng tập của một Instant ISO.
export function getGymLocalIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Giờ HH:mm (24h) theo giờ phòng tập.
export function formatGymTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Ngày dd/MM/yyyy theo giờ phòng tập.
export function formatGymDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Tiêu đề nhóm ngày, ví dụ "Thứ Hai, 05/10/2026".
export function formatGymDayHeading(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// YYYY-MM-DD (+ hh:mm, mặc định 00:00) theo giờ phòng tập -> Instant UTC (ISO).
// Đây là cách BE hiểu ranh giới: endTime > from VÀ startTime < to.
export function gymLocalDateToIsoInstant(dateStr, hhmm = '00:00') {
  if (!dateStr || !ISO_DATE_RE.test(dateStr)) return null;
  const [hh, mm] = hhmm.split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }
  const composed = new Date(
    `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`,
  );
  if (Number.isNaN(composed.getTime())) return null;
  return composed.toISOString();
}

// Hết ngày YYYY-MM-DD (= 00:00 của ngày kế tiếp), dùng làm mốc `to` để chọn
// "đến ngày X" thì vẫn lấy các buổi tập trong ngày X.
export function gymEndOfDayIsoInstant(dateStr) {
  const start = gymLocalDateToIsoInstant(dateStr, '00:00');
  if (!start) return null;
  const next = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000);
  return next.toISOString();
}

// Thứ Hai 00:00 và Thứ Hai kế tiếp 00:00 (theo giờ phòng tập) của tuần chứa
// ngày `referenceLocalYmd` (hoặc hôm nay nếu bỏ trống / sai định dạng).
export function getWeekRangeDates(referenceLocalYmd) {
  const ref =
    referenceLocalYmd && ISO_DATE_RE.test(referenceLocalYmd)
      ? referenceLocalYmd
      : getGymZoneTodayIsoDate();
  // Neo lúc 12:00 +07:00 để tránh nhập nhằng ở ranh giới ngày.
  const probe = new Date(`${ref}T12:00:00+07:00`);
  if (Number.isNaN(probe.getTime())) return null;

  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'short',
  }).format(probe);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd];
  if (dow == null) return null;

  // Lùi về Thứ Hai: (dow + 6) % 7 ngày.
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(probe.getTime());
  monday.setUTCDate(monday.getUTCDate() - offsetToMonday);
  const nextMonday = new Date(monday.getTime());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return {
    mondayYmd: getGymLocalIsoDate(monday.toISOString()),
    nextMondayYmd: getGymLocalIsoDate(nextMonday.toISOString()),
  };
}
