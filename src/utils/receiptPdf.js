import { formatDateTime, formatPrice } from './index';

// Renders the receipt to a real .pdf file.
//
// jsPDF ships with Helvetica, whose WinAnsi encoding has no Vietnamese
// vowels, so "Hội viên" would come out as mojibake. Everything here is
// therefore ASCII-only: labels stay in English, and any value that may
// contain Vietnamese text (member name, plan name) is transliterated to
// plain ASCII. The Vietnamese copy stays on the on-screen receipt, which is
// the version the customer actually reads at the counter.
const ASCII_MAP = {
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
  ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
  ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  đ: 'd', Đ: 'D',
};

export function toAscii(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[èéẻẽẹêềếểễệ]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[ìíỉĩị]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[ùúủũụưừứửữự]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[ỳýỷỹỵđĐ]/g, (c) => ASCII_MAP[c] ?? c)
    .replace(/[^\x20-\x7E]/g, '');
}

export const RECEIPT_METHOD_LABELS = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
};

const METHOD_LABELS_VI = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
};

export function paymentMethodLabel(method) {
  return METHOD_LABELS_VI[method] || method || '—';
}

/**
 * Builds the receipt PDF.
 *
 * `memberName`, `memberCode` and `offerName` are read straight off the
 * receipt (ReceiptResponse carries all three as of backend commit af38eaa)
 * and passed in already-resolved by ReceiptPage. `durationDays` is the one
 * exception: it is not on ReceiptResponse, so the caller may omit it and the
 * row is then left off the PDF.
 *
 * jspdf is imported dynamically: it is ~350 kB and the receptionist opens
 * this page far less often than the dashboard, so there is no reason to put
 * it in the initial bundle.
 */
export async function buildReceiptPdf({
  receipt,
  memberName,
  memberCode,
  offerName,
  planName,
  durationDays,
}) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const setFont = (size, style = 'normal') => doc.setFont('helvetica', style);
  const text = (value, x, options = {}) => {
    setFont(options.size ?? 10, options.style ?? 'normal');
    doc.text(toAscii(value), x, y, { align: options.align ?? 'left' });
    if (options.gap) y += options.gap;
  };
  const line = () => {
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  text('RECEIPT / BIEN LAI THU TIEN', margin, {
    size: 15,
    style: 'bold',
    gap: 5,
  });
  text('Gym Membership Center', margin, { size: 9, gap: 8 });
  line();

  text('Receipt No.', margin, { size: 10, style: 'bold' });
  text(receipt.receiptNumber || '—', pageWidth - margin, {
    size: 10,
    style: 'bold',
    align: 'right',
    gap: 4,
  });
  text('Issued at', margin, { size: 9 });
  text(formatDateTime(receipt.issuedAt), pageWidth - margin, {
    size: 9,
    align: 'right',
    gap: 7,
  });

  text('Member', margin, { size: 9, style: 'bold' });
  text(memberName || '—', pageWidth - margin, { size: 9, align: 'right', gap: 3 });
  text('Member code', margin, { size: 9 });
  text(memberCode || '—', pageWidth - margin, { size: 9, align: 'right', gap: 3 });
  text('Plan', margin, { size: 9 });
  text(offerName || '—', pageWidth - margin, { size: 9, align: 'right', gap: 3 });
  if (planName) {
    text('Plan code', margin, { size: 9 });
    text(planName, pageWidth - margin, { size: 9, align: 'right', gap: 3 });
  }
  if (durationDays != null) {
    text('Duration', margin, { size: 9 });
    text(`${durationDays} days`, pageWidth - margin, { size: 9, align: 'right', gap: 3 });
  }
  line();

  text('AMOUNT', margin, { size: 9, style: 'bold' });
  text(
    formatPrice(receipt.amount, receipt.currency).replace(/[^\x20-\x7E]/g, ''),
    pageWidth - margin,
    { size: 13, style: 'bold', align: 'right', gap: 4 },
  );
  text('Payment method', margin, { size: 9 });
  text(RECEIPT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod || '—', pageWidth - margin, {
    size: 9,
    align: 'right',
    gap: 7,
  });
  line();

  text('Order ID', margin, { size: 8, gap: 3 });
  text(receipt.orderId || '—', margin, { size: 8, gap: 3 });
  text('Payment ID', margin, { size: 8, gap: 3 });
  text(receipt.paymentId || '—', margin, { size: 8, gap: 3 });
  text('Receipt ID', margin, { size: 8, gap: 8 });

  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    'Thank you. Please keep this receipt for your records.',
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  return doc;
}

export async function downloadReceiptPdf(payload) {
  const doc = await buildReceiptPdf(payload);
  const number = (payload.receipt?.receiptNumber || 'receipt').replace(/[^\w-]/g, '_');
  doc.save(`${number}.pdf`);
}
