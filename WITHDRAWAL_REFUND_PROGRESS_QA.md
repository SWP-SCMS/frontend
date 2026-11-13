# Withdrawal refund progress

The withdrawal decision and refund progress are independent. Approval stays `APPROVED`; only a linked refund at `COMPLETED` displays **Hoàn tiền thành công**. A recorded disbursement displays **Đã chi hoàn tiền — chờ xác minh**. Missing or unknown progress is explicitly unknown, including when this frontend runs against an older backend.

Manager list/detail, member history and receptionist history use the same badge helper. Existing decision filters/actions, payout eligibility, verification and polling remain in place. Manager detail links to the exact refund obligation returned by the API.

## Revisions and reproduction

- Backend: `7ca0e59a6250a9d09543f6800b61ce88d2601e6b` on `main`, squash merge of [PR #209](https://github.com/SWP-SCMS/backend/pull/209). Its tree is identical to the tested fix `198d3008af94a820648a66c8e2f3a8e77b4f1547`.
- Frontend: the commit containing this report, on the same branch name. Every runtime run writes both exact SHAs and the frontend dirty flag to `.course-qa/runtime-*/sources.json`; the CI artifact records the committed frontend SHA.
- Runtime launcher and CI pin the backend SHA above and retain the version check.
- Compile backend test classes and classpath: `./mvnw -ntp test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=target/qa-classpath.txt`.
- Set `COURSE_QA_BACKEND` to that backend checkout; run `npm run test:course-runtime` with Java 21, Docker and Chromium installed.

## Verification

- Backend: the new regression failed on the old API, then passed after the projection change. The focused integration/contract run passed 138 tests; the final unit/web suite passed 1,072 tests. The zero-refund regression was rerun successfully. GitHub Actions passed unit tests and all four integration shards for the backend commit.
- Frontend unit suite: 44 passed; lint and production build passed.
- Mocked browser suite: 59 passed. The manager progress test also passed again after adding stable desktop/mobile screenshot capture. These tests cover refresh/reload, long labels, missing refund fields, matching refund links and absent repeat approval actions.
- Real browser/API/PostgreSQL suite: all 11 tests passed. The new journey: member requests withdrawal, manager approves withdrawal and refund, receptionist records disbursement after course completion, manager verifies, then all three roles reread the progress. The member page also reloads; the receptionist payout queue no longer offers the completed refund. No refund responses are mocked in this journey.
- The controlled clock advances through existing scheduler/eligibility rules; no product policy or production data is modified. PostgreSQL is disposable. References and payment evidence are synthetic; no money is transferred.

## Evidence

- `test-results/runtime-report.json`: assertions, role API journal, intermediate and final verified state.
- `test-results/runtime-browser/zz-withdrawal-refund-*/`: manager, member and receptionist screenshots at `DISBURSEMENT_RECORDED` and `COMPLETED`.
- `.course-qa/runtime-*/withdrawal-refund-progress.json`: direct database snapshot with withdrawal/refund IDs, statuses and disbursed/verified amounts.
- `.course-qa/runtime-*/database-counts.json`: duplicate fulfillment checks.
- CI uploads the runtime report, screenshots, database snapshots and revision evidence as `course-runtime-push`.

Updating the previously stale backend pin exposed an old schedule fixture that cancelled a session after enrollment. Current main correctly rejects that operation with `SESSION_HAS_MEMBERS`. The fixture now creates makeup before enrollment, preserves the original timeline/UI assertions, and additionally asserts rejection and no extra session after enrollment.

## Boundaries

No attendance fix, full-system audit or production deployment is included. Backend PR #209 was merged after all push/PR checks and CodeQL passed; the frontend pin now targets that merged commit. Existing untracked `.playwright-cli/` files are excluded from the commit. The production build retains its existing authService dynamic/static import warning; it does not fail the build.
