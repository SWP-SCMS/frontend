# Frontend pre-push verification — 2026-11-06

Scope: weekly course-run form and schedule preview, course-image upload, refund source labels and queue refresh, payment helper cleanup, and accompanying QA/handoff documents.

- PASS: npm run lint.
- PASS: npm test — 40 tests, zero failures.
- PASS: npm run build. Non-blocking warning: authService.js is imported both statically and dynamically, so the dynamic import does not create a separate chunk.
- PASS: 24 Playwright UI tests in tests/t13-t24.spec.js and tests/course-workflows.spec.js with PLAYWRIGHT_CHANNEL=chrome.
- Initial Playwright attempt could not launch because bundled Chromium was missing; switching to installed Chrome resolved the environment issue.
- UI tests use mocked API responses. No live-backend Chrome MCP test was repeated in this pre-push run; historical live QA is documented separately.
- PASS: git diff --cached --check.
- Corresponding backend changes published on fix/t13-t24-qa, commit e164b20, including V74/V75 migrations. Merge/deploy the matching backend for the new endpoints and refund semantics.
- Publication target: style/ui-consistency. No merge into main.
- One-off code rewriting scripts scripts/t13-polish.py, scripts/t14-workflows.py and scripts/t19-finish.py remain local and are excluded.
