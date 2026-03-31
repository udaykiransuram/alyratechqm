# Online Test Operational Checklist

Use this checklist after automated preflight passes and before approving production rollout.

Automated coverage now verifies:

- student session-lock acquisition and release in the real-backend integration suite
- online-test integration against the fallback runtime and, when `EXAM_RUNTIME_DATABASE_URL` is configured for a managed lane, the exam-runtime-backed path as well

Keep the checklist below for deployment-specific sign-off and rollback drills.

## 1) Student session lock behavior

- [ ] Sign in as one student in browser A and confirm `/student/tests` loads.
- [ ] Attempt sign-in for the same student in browser B without signing out from browser A.
- [ ] Confirm second sign-in is blocked with active-session behavior.
- [ ] Sign out from browser A and confirm browser B can sign in afterward.

## 2) Exam runtime mode toggle in staging

- [ ] Run student online-test flow with exam runtime disabled (`EXAM_RUNTIME_DATABASE_URL` unset).
- [ ] Run the same flow with exam runtime enabled (`EXAM_RUNTIME_DATABASE_URL` configured).
- [ ] Confirm both modes pass start, autosave, submit, and report visibility checks.
- [ ] Confirm analytics and class export flows still work for submitted attempts.

## 3) Rollback safety

- [ ] Capture pre-release backup/snapshot for tenant data used by online tests.
- [ ] Deploy candidate build and execute canary student attempts.
- [ ] Roll back to previous stable release.
- [ ] Verify no data corruption: attempts remain readable, statuses are valid, and answers are preserved.
- [ ] Re-deploy candidate build and verify attempts continue without duplication/regression.
