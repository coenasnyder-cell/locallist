# Closed Beta Rollout Playbook

## Objective
Run a controlled beta that validates stability, onboarding conversion, and monetization flow before app store submission.

## Timeline (7 Days)

1. Day 1: Internal smoke test (team only)
2. Day 2-3: Cohort A (new users + core listing flow)
3. Day 4-5: Cohort B (power sellers + featured checkout)
4. Day 6: Cohort C (business accounts + services/events)
5. Day 7: Triage sweep + go/no-go decision

## Tester Cohorts

1. Cohort A (10-15 testers)
- Goal: Sign up to first listing in under 2 minutes
- Required flows: signup, draft restore, listing submit

2. Cohort B (10 testers)
- Goal: Monetization and reliability
- Required flows: featured checkout, listing edits, messaging

3. Cohort C (5-10 testers)
- Goal: Business workflow coverage
- Required flows: business profile updates, service posts, promotions

## Device Coverage Matrix

1. Android
- 1 low-tier device
- 1 mid-tier device
- 1 high-tier device

2. iOS
- 1 older supported model
- 1 current-generation model

3. Network conditions
- Normal Wi-Fi
- Mobile data
- Throttled network pass (3G simulation)

## Feedback Collection
Use in-app route /(app)/beta-feedback for all feedback submissions.

Required bug report fields:
1. Issue type
2. Short title
3. Steps to reproduce
4. Expected result
5. Actual result
6. Device/OS details

## Triage Model

Severity definitions:
1. P0: App crash, auth/payment blocker, data loss
2. P1: Core flow failure with workaround unavailable
3. P2: UX defects with workaround
4. P3: Cosmetic/non-blocking polish

SLA:
1. P0 acknowledged in 30 minutes, fixed same day
2. P1 acknowledged in 2 hours, fixed within 24 hours
3. P2 triaged daily, fixed before public launch if high-volume
4. P3 backlog candidate unless repeated across testers

## Daily Triage Routine

1. Review betaFeedback collection in Firestore
2. Merge duplicates and mark canonical issue
3. Assign severity and owner
4. Update status: open -> investigating -> fixed -> verified
5. Publish daily summary to team

## Exit Criteria (Go/No-Go)

Release candidate is approved only if all are true:
1. No open P0/P1 issues
2. Crash-free sessions >= 99.5% during beta window
3. Median startup time <= 3 seconds
4. App funnel events recorded end-to-end
5. Featured checkout success rate >= 99%
6. Compliance checklist items complete

## Commands

1. Readiness gate:
npm run release:step6

2. Optional quality-only run:
npm run quality:pre-release

## Deliverables At Beta End

1. Final issue list with severity and disposition
2. Performance summary (startup, query latency, crash rate)
3. Funnel conversion snapshot (CTA -> form start -> submit -> featured)
4. Go/no-go decision log signed by product and engineering
