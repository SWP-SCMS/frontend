// Shared backend-error → RHF error mapping helper.
//
// SCOPE (kept deliberately small — do not grow this helper):
//   ✓ Spring ProblemDetail per-field errors: data.errors[field]
//     — ONLY for fields explicitly passed in the caller's `fields` allowlist.
//   ✓ EMAIL_ALREADY_EXISTS  → email
//     — ONLY if 'email' is in the caller's `fields` allowlist.
//   ✓ PHONE_ALREADY_EXISTS  → phone
//     — ONLY if 'phone' is in the caller's `fields` allowlist.
//
// OUT OF SCOPE (handled page-locally; do not add here):
//   ✗ CURRENT_PASSWORD_INCORRECT       (F03 MemberChangePasswordPage)
//   ✗ NEW_PASSWORD_SAME_AS_CURRENT     (F03 MemberChangePasswordPage)
//   ✗ DISCIPLINE_*                     (F10/F11 Discipline pages)
//   ✗ CLASS_*                          (F12/F13 Class pages)
//   ✗ MembershipOffer codes            (F14/F15 MembershipOffer pages)
//   ✗ ACCOUNT_IDENTIFIER_ALREADY_EXISTS — global ErrorAlert (no field clue)
//
// Why an explicit allowlist?
//   If the backend returns a per-field error for a field the page does not
//   render (e.g. an internal/server-side field, or a typo on the wire), the
//   helper MUST NOT blindly call setError(unknownField, ...). Doing so would
//   suppress the global ErrorAlert (because `handled === true`) while the
//   user sees no inline error anywhere. The fix is: the helper only acts
//   on fields the caller has explicitly registered in its form. Any
//   unknown / unrendered field falls through and the page's ErrorAlert
//   still surfaces the failure.
//
// Usage in a migrated page:
//
//   try {
//     await api.create(payload);
//   } catch (err) {
//     const handled = applyServerErrors(err, setError, {
//       fields: ['fullName', 'phone', 'email', 'birthDate', 'password', 'confirmPassword'],
//     });
//     // The page's global ErrorAlert should still render `err` so unknown
//     // errors are visible regardless of `handled`.
//     setServerError(err);
//     // ... page-local code mappings (DISCIPLINE_NAME_CONFLICT, etc.)
//   }
//
// Returns `true` if at least one allowed/rendered field received an error
// via setError. Returns `false` if no allowed field matched.

function pickMessage(list) {
  if (Array.isArray(list)) {
    const first = list.find(
      (m) => typeof m === 'string' && m.trim().length > 0,
    );
    return first || null;
  }
  if (typeof list === 'string' && list.trim().length > 0) return list;
  return null;
}

// Build a Set for O(1) allowlist lookup. Defensive: if the caller passes
// a non-array (e.g. undefined, null, string), treat as empty allowlist so
// the helper becomes a no-op and the page's global ErrorAlert takes over.
function makeAllowlist(fields) {
  if (Array.isArray(fields)) {
    return new Set(fields.filter((f) => typeof f === 'string' && f));
  }
  return new Set();
}

export function applyServerErrors(err, setError, options) {
  const data = err?.response?.data;
  let handled = false;

  // Build the allowlist ONCE per call. The helper will not act on a
  // field that is not in this set.
  const allowed = makeAllowlist(options && options.fields);

  // 1) Spring per-field validation errors — restricted to allowed fields.
  if (data && data.errors && typeof data.errors === 'object') {
    for (const [field, list] of Object.entries(data.errors)) {
      if (!allowed.has(field)) continue; // unknown / unrendered field — fall through.
      const msg = pickMessage(list);
      if (msg) {
        setError(field, { type: 'server', message: msg });
        handled = true;
      }
    }
  }

  // 2) Cross-domain conflict codes (account identifier uniqueness).
  //    Each is gated on the corresponding field being in the allowlist.
  const code = data?.code;

  if (code === 'EMAIL_ALREADY_EXISTS' && allowed.has('email')) {
    setError('email', {
      type: 'server',
      message: 'Email này đã được một tài khoản khác sử dụng.',
    });
    handled = true;
  }

  if (code === 'PHONE_ALREADY_EXISTS' && allowed.has('phone')) {
    setError('phone', {
      type: 'server',
      message: 'Số điện thoại này đã được một tài khoản khác sử dụng.',
    });
    handled = true;
  }

  // ACCOUNT_IDENTIFIER_ALREADY_EXISTS intentionally NOT mapped here:
  // the backend does not identify one specific field. The page surfaces
  // it through its existing global notice / ErrorAlert.

  return handled;
}
