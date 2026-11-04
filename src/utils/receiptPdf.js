import { formatPrice } from './index';
import { formatGymDate, formatGymTime } from './gymTime';

export const RECEIPT_METHOD_LABELS = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
};

export function paymentMethodLabel(method) {
  return RECEIPT_METHOD_LABELS[method] || method || '—';
}

let fontPromise;
async function receiptFonts() {
  if (!fontPromise) {
    fontPromise = Promise.all(['Regular', 'Bold'].map(async (style) => {
      const response = await fetch(`${import.meta.env.BASE_URL}fonts/noto-sans/NotoSans-${style}.ttf`);
      if (!response.ok) throw new Error('Không tải được phông chữ biên lai. Vui lòng thử lại.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return btoa(binary);
    })).catch(() => {
      fontPromise = undefined;
      throw new Error('Không tải được phông chữ biên lai. Vui lòng thử lại.');
    });
  }
  return fontPromise;
}

// Text remains searchable/copyable; fonts load only when exporting a receipt.
export async function buildReceiptPdf({ receipt, memberName, memberCode, offerName }) {
  const [{ jsPDF }, fonts] = await Promise.all([import('jspdf'), receiptFonts()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true, compress: true });
  ['Regular', 'Bold'].forEach((style, index) => {
    const filename = `NotoSans-${style}.ttf`;
    doc.addFileToVFS(filename, fonts[index]);
    doc.addFont(filename, 'NotoSans', index ? 'bold' : 'normal');
  });
  doc.setProperties({ title: `Biên lai ${receipt.receiptNumber || ''}`, author: 'SWP GYM' });
  doc.setLineHeightFactor(1.4);
  const width = doc.internal.pageSize.getWidth();
  const bottom = doc.internal.pageSize.getHeight() - 22;
  const margin = 22;
  const valueX = 94;
  const lineHeight = 5.5;
  let y = 26;
  const font = (size = 11, bold = false, color = '#111827') => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const ensureSpace = (height) => {
    if (y + height > bottom) { doc.addPage(); y = 26; }
  };
  const rule = (dashed = false) => {
    doc.setDrawColor('#d1d5db');
    doc.setLineWidth(0.2);
    doc.setLineDashPattern(dashed ? [0.7, 0.7] : [], 0);
    doc.line(margin, y, width - margin, y);
    doc.setLineDashPattern([], 0);
  };
  const row = (label, value) => {
    font();
    const lines = doc.splitTextToSize(String(value ?? '—').normalize('NFC'), width - margin - valueX);
    let offset = 0;
    while (offset < lines.length) {
      ensureSpace(lineHeight + 6);
      const count = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - 6) / lineHeight)));
      font(10, false, '#6b7280');
      doc.text(label, margin, y);
      font();
      lines.slice(offset, offset + count).forEach((line, i) => doc.text(line, valueX, y + i * lineHeight));
      y += count * lineHeight + 2;
      rule(true);
      y += 5;
      offset += count;
    }
  };

  font(18, true);
  doc.text('BIÊN LAI THU TIỀN', width / 2, y, { align: 'center' });
  y += 9;
  font(11, false, '#6b7280');
  doc.text('SWP GYM — Trung tâm quản lý hội viên', width / 2, y, { align: 'center' });
  y += 15;

  row('Số biên lai', receipt.receiptNumber);
  row('Ngày xuất', `${formatGymDate(receipt.issuedAt)} · ${formatGymTime(receipt.issuedAt)}`);
  row('Hội viên', memberName ?? receipt.memberName);
  row('Mã hội viên', memberCode ?? receipt.memberCode);
  row('Gói tập', offerName ?? receipt.offerName);
  row('Mã đơn', receipt.orderNumber);
  if (receipt.paymentReference) row('Mã giao dịch', receipt.paymentReference);
  row('Phương thức', paymentMethodLabel(receipt.paymentMethod));

  ensureSpace(44);
  y += 1;
  rule();
  y += 10;
  font(11, false, '#6b7280');
  doc.text('Số tiền đã thanh toán', width / 2, y, { align: 'center' });
  y += 11;
  font(20, true, '#dc3545');
  doc.text(formatPrice(receipt.amount, receipt.currency), width / 2, y, { align: 'center' });
  y += 9;
  rule();
  y += 10;
  font(10, false, '#6b7280');
  doc.text('Cảm ơn quý khách. Vui lòng giữ lại biên lai này.', width / 2, y, { align: 'center' });
  return doc;
}

export async function downloadReceiptPdf(payload) {
  const doc = await buildReceiptPdf(payload);
  const number = (payload.receipt?.receiptNumber || 'receipt').replace(/[^\w-]/g, '_');
  doc.save(`${number}.pdf`);
}
