# Course Booking — integration handoff

Backend reference: 6fdd77d. Backend read-only. Tests intentionally not run; user performs functional QA.

## Implemented scope
- Phase 7: enrollment lifecycle, disposition and attendance counts; Course sessions on the personal weekly calendar; calendar viewing has no gym benefit guard. Gym booking/PT actions retain their existing benefit guards.
- Phase 8: read-only schedule change history and notification routing; Manager cancel/makeup with expectedVersion. Withdrawal/transfer choices are not enabled.
- Phase 10: waitlist history, invitation expiry, accepted order continuation, stable retry keys, partial load handling.
- Phase 11: source review and manual checklist. This is not a claim of runtime acceptance.

## Manual checklist
- Course-only member opens personal calendar and Course pages; cannot book gym/PT without their respective benefits.
- Calendar distinguishes Course from gym/PT. Course selection never opens gym booking actions.
- Attendance uses BE values, not inferred absence; transferred enrollments retain history but leave the active calendar.
- Empty enrollment, empty waitlist, one API failing and retry all give understandable UI states.
- Reception search by member code and phone; inactive member cannot create an order. Verify cash, QR, duplicate-click prevention and retry after network failure.
- Two members compete for last seat; BE capacity/conflict errors remain authoritative.
- Manager minimum enrollment is editable only in DRAFT. Verify automatic CONFIRMED/CANCELLED after registration closes.
- Manager reschedules, cancels, makes up a session; verify old/new times, version conflict, resource conflict and notification destination.
- Waitlist WAITING/INVITED/ACCEPTED/EXPIRED/CANCELLED/LEFT: position, expiry, payment continuation and disabled actions.
- Confirm payment order can still be viewed when public Run is no longer in catalog.
- No UUID/raw error code shown in the new flows; money/refund authority stays on BE.

## Contract gaps / unresolved rules
- Coach assigned Course Run/session list API missing; roster/attendance alone cannot provide discovery.
- Reception course/run creation and Manager approval APIs absent.
- Enrollment list lacks payment summary, Run status and original/makeup status; it cannot reliably identify cancelled Run sessions for the personal calendar. No per-enrollment lookup workaround added.
- Waitlist lacks Run name/code; optional catalog names are best effort, not a complete source (first 100 public runs). Missing names use neutral text.
- Schedule-change API uses >30 minutes/day change and a response deadline, not the agreed 70%/7-day withdrawal rules. No withdrawal/transfer response UI enabled.
- Full withdrawal approval/refund read/disbursement API missing. No FE refund calculations.
- Transfer queue/offer lacks business names; transfer UI deferred.
- Session response lacks isMakeup; cancelled makeup can appear eligible in UI but BE rejects replacing a makeup session. BE validation remains authoritative.
- No fabricated Run status or settlement completion. UNRESOLVED does not mean money was paid.

## Form convention review
- Course forms now use React Hook Form and Zod resolvers with inline validation feedback.
- Date/time fields reuse the shared DateInput and use gym UTC+07 on submission.
- Verify empty/whitespace inputs, invalid dates, reversed dates, fractional/negative amounts, minimum above capacity, modal reopen/reset and failed submission retry.
- Numbers above JavaScript safe integer are rejected rather than silently rounded.
- Focused lint and diff checks passed; functional tests remain user-owned and were not run.

## Update 2026-11-01 — backend 6097813
This section supersedes the earlier blanket statement that withdrawal decision/refund review APIs are missing.
- BE now supports withdrawal creation/history/Manager decisions and Manager refund obligation review.
- FE implements Member withdrawal creation/history, safe error labels and notification labels. Submitted requests remain in the calendar while WITHDRAWAL_PENDING.
- No client refund calculation: pending amounts are unknown, zero is shown only when BE returns zero. Withdrawal approval and refund approval do not mean disbursement completed.
- Manager queue/refund UI remains deferred: DTOs lack Member/Run business names. Reception withdrawal creation lacks enrollment discovery. No per-row requests added.
- Disbursement/final verification and Member refund-obligation read API remain unavailable.

Manual acceptance (not executed):
1. Member opens Khóa học của tôi, selects an active Run, submits a trimmed reason of 1–1000 characters. Empty reason/selection show inline validation.
2. Double-click, timeout after server commit and retry: pending request is visible and cannot be duplicated from the form. Failed history reload disables submission.
3. Pending withdrawal retains personal calendar/attendance. Refresh the full page after a Manager decision: rejection restores ACTIVE; approval shows WITHDRAWN and removes active calendar sessions.
4. Check closed withdrawal window, open transfer, inactive enrollment and already-pending errors; UI must show Vietnamese explanations, no internal IDs.
5. Pending/refused requests with null refund display Chưa xác định; approved zero refund displays 0; nonzero refund exactly uses the BE response.
6. Withdrawal/refund notifications use human-readable labels and Member destination /member/courses. There is no claim of paid refund or available disbursement action.
7. Verify missing enrollment names use neutral text, no UUID fallback, and browser network has no per-request name lookups.
