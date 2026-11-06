# Runtime CI repair — 2026-11-06

The original runtime suite failed five browser scenarios although build and mocked UI tests passed.

- Visit /member/courses/withdrawals for the separated withdrawal workflow.
- Confirm React modal dialogs instead of waiting for obsolete window.confirm dialogs.
- Scope transfer acceptance to the target run card and retain the transfer-specific confirmation assertions.
- Expect the localized label Chờ Quản lý duyệt.
- Pin both workflow and launcher to merged backend main ef4091734d32a3672999e05ec4089be20455ea9f (same tree as backend CI repair 81e4ea4).

PASS locally: lint, 40 unit tests, git diff --check. Full disposable PostgreSQL/browser runtime validation runs in GitHub Actions because local Docker is unavailable. All fulfillment, amount, idempotency and access-control assertions remain enabled; no tests skipped.
