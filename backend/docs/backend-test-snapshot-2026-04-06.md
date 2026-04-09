# Backend Test Snapshot Report

## 1) Snapshot Metadata

- Project: backend
- Report source: `backend/jest-backend.json`
- Trigger command: `npm test -- --json --outputFile jest-backend.json`
- Run window (UTC): 2026-04-06T02:15:18.881Z -> 2026-04-06T02:16:21.331Z
- Total wall time: 62.45s
- Interrupted: no

## 2) Executive Summary

- Overall status: PASSED
- Test suites: 8 passed / 8 total
- Test cases: 213 passed / 213 total
- Failed tests: 0
- Pending/Todo: 0
- Runtime-error suites: 0

Quality signal:
- This snapshot indicates stable backend behavior for integration-heavy API paths (auth, admin, events, tickets, marketplace, users, image upload) and property-based validation checks.

## 3) Jest Snapshot Section (Literal Snapshot Assertions)

From Jest `snapshot` object in the report:

- total: 0
- matched: 0
- unmatched: 0
- updated: 0
- added: 0
- filesAdded/filesUpdated/filesRemoved: 0/0/0
- snapshot failure: false

Interpretation:
- This run did not contain Jest literal snapshot assertions (`toMatchSnapshot`).
- The phrase "snapshot" here refers to the captured test-result state of this run.

## 4) Suite-Level Breakdown

| Suite file | Status | Test cases | Duration (ms) | Duration (s) |
| --- | --- | ---: | ---: | ---: |
| validation.properties.test.js | passed | 9 | 34316 | 34.32 |
| image-upload.routes.integration.test.js | passed | 12 | 6818 | 6.82 |
| admin.routes.integration.test.js | passed | 48 | 4089 | 4.09 |
| auth.routes.integration.test.js | passed | 33 | 3822 | 3.82 |
| tickets.routes.integration.test.js | passed | 33 | 3813 | 3.81 |
| marketplace.routes.integration.test.js | passed | 26 | 3594 | 3.59 |
| users.routes.integration.test.js | passed | 27 | 3053 | 3.05 |
| events.routes.integration.test.js | passed | 25 | 2836 | 2.84 |

Notes:
- `validation.properties.test.js` is the dominant runtime contributor (~54.95% of wall time).
- Remaining suites are well-balanced and mostly within ~3-7 seconds each.

## 5) Slowest Test Cases (Top 10)

| Rank | Suite | Test | Duration (ms) |
| ---: | --- | --- | ---: |
| 1 | validation.properties.test.js | GET /api/tickets validates invalid query parameters | 7320 |
| 2 | validation.properties.test.js | GET /api/marketplace/listings validates invalid query parameters | 5489 |
| 3 | validation.properties.test.js | GET /api/events validates invalid query parameters | 4521 |
| 4 | validation.properties.test.js | POST /api/auth/nonce validates wallet address format | 4219 |
| 5 | validation.properties.test.js | POST /api/auth/verify validates signature format | 4144 |
| 6 | image-upload.routes.integration.test.js | should reject file exceeding 5MB size limit | 3465 |
| 7 | validation.properties.test.js | POST /api/events returns auth error for unauthenticated request with invalid body | 1620 |
| 8 | validation.properties.test.js | POST /api/auth/verify with valid formats does not fail at format validator | 1342 |
| 9 | validation.properties.test.js | POST /api/tickets/verify returns auth error for unauthenticated request | 1194 |
| 10 | validation.properties.test.js | POST /api/auth/nonce accepts structurally valid wallet format | 496 |

Interpretation:
- Property-based tests intentionally execute many generated cases, so higher duration is expected.
- The upload size-limit scenario is expected to be slower due to large payload validation.

## 6) Coverage of Critical Business Flows

The snapshot confirms pass status on these flow groups:

- SIWE auth lifecycle: nonce, message, verify, logout, refresh, replay and domain checks
- Admin operations: stats, user role updates, user deletion, event moderation, health endpoint
- Event lifecycle: create/read/update/delete, filtering, validation, organizer authorization
- Ticket lifecycle: query, ownership verify, mark used, status/time-window constraints
- Marketplace lifecycle: create/cancel listing, stats, price and ownership constraints
- User profile lifecycle: read/update, duplicate constraints, validation shape consistency
- Media workflows: avatar upload/replace, event image upload/delete, limits and MIME checks
- Property-level validation invariants across multiple API endpoints

## 7) Risk Assessment

- Functional regression risk (current snapshot): low
- Performance hotspot risk: medium in property-based suite due to heavy generated-case execution
- Flakiness signal: low in this run (no retries, no interrupted run, no pending tests)

## 8) Recommended Follow-Up Actions

1. Keep this report as baseline for future comparisons of suite duration deltas.
2. Track `validation.properties.test.js` runtime over time; investigate if it grows above 45-50s.
3. If CI budget is strict, separate property suite into a dedicated CI job or nightly profile.
4. Continue exporting JSON report each full run for machine-comparable historical snapshots.

## 9) Reproduce This Snapshot Format

From repository root:

```bash
cd backend
npm test -- --json --outputFile jest-backend.json
```

Optional quick metric extraction:

```bash
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync('jest-backend.json','utf8'));console.log({suites:r.numPassedTestSuites+'/'+r.numTotalTestSuites,tests:r.numPassedTests+'/'+r.numTotalTests,failed:r.numFailedTests});"
```
