// Shared Zod schema fragments for create-page validation.
//
// Rules are derived strictly from the audited contracts in
// docs/frontend-rhf-zod-migration-audit.md and the current source.
// Do not add speculative constraints here.

import { z } from 'zod';
import { normalizePhone } from '../utils';

// Pragmatic email shape. The backend does the authoritative validation;
// this just avoids obvious typos. Match the regex used by the current
// source (RegisterPage, MemberCreatePage, StaffAccountCreatePage).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// fullName — required, trimmed, non-blank, max 200 (BE @Size(max=200)).
// Trims before sending so the wire value matches the existing behavior.
export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập họ và tên.')
  .max(200, 'Họ và tên không được vượt quá 200 ký tự.');

// email — required, regex-checked, max 320 (BE).
// The base email() / .email() helper is intentionally NOT used so that
// the regex shape stays exactly what the current source enforces.
// The wire value retains the trimmed string; downstream code lowercases
// for fullName/email-compare pages, but the schema itself does not
// lowercase (preserves current source: existing pages lowercase at
// the payload assembly step, not at validation).
export const emailSchema = z
  .string()
  .trim()
  .regex(EMAIL_RE, 'Email không hợp lệ.')
  .max(320, 'Email không được vượt quá 320 ký tự.');

// phoneCreateSchema — required, validated through the existing
// normalizePhone() helper, transformed to the canonical 10-digit form.
// Use this for create pages where a blank phone is invalid.
// Wire value: canonical 10-digit Vietnamese mobile, e.g. "0901234567".
export const phoneCreateSchema = z
  .string()
  .trim()
  .refine((s) => normalizePhone(s) != null, {
    message: 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.',
  })
  .transform((s) => normalizePhone(s));

// phoneEditOptionalSchema — for PATCH edit pages (F08 StaffAccountEditPage,
// F09 MemberAccountEditPage) where the existing semantics are:
//
//   blank phone  -> allowed as form state, OMITTED from PATCH (do not update)
//   nonblank     -> normalize + validate; sent only when changed per buildPatch
//
// Shared by F08 and F09 because they have the byte-for-byte same contract.
// Do NOT use this schema on create pages (use phoneCreateSchema) or anywhere
// "blank = null" is desired (those pages use a different shape and live
// outside Wave 2).
export const phoneEditOptionalSchema = z
  .string()
  .refine(
    (s) => s === '' || normalizePhone(s) != null,
    'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.',
  )
  .transform((s) => (s === '' ? '' : normalizePhone(s)));

// birthDateSchema — required yyyy-MM-dd, must not be in the future.
// NO minimum-age refinement here: that is a pre-existing FE-only
// stricter rule on RegisterPage and must NOT be propagated.
export const birthDateSchema = z
  .string()
  .min(1, 'Vui lòng nhập ngày sinh.')
  .refine(
    (d) => d <= new Date().toISOString().slice(0, 10),
    'Ngày sinh không được ở tương lai.',
  );

// passwordSchema — required, min 8.
// Passwords are NOT trimmed and NOT lowercased; the schema is byte-faithful
// to the user's input to preserve all punctuation characters that the
// current RegisterPage and ChangePasswordPage submit unchanged.
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.');
