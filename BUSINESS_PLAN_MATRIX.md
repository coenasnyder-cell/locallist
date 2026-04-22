# Business Plan Matrix

This report reflects the current codebase as of April 22, 2026.

## Summary

- Business analytics are available to business accounts today in both the app and web experience.
- Premium is marketed as including deeper analytics and extra business tools.
- In the current implementation, most analytics are not actually premium-gated yet.
- The clearest implemented premium differences today are around visibility/placement and some promotion behavior, not a separate analytics dashboard.

## Free vs Premium

| Capability | Free Business | Premium Business | Current State | Key Sources |
| --- | --- | --- | --- | --- |
| Business Hub access | Yes | Yes | Implemented | `app/(app)/business-hub.tsx`, `public/business-hub.html` |
| Basic analytics snapshot in app | Yes | Yes | Implemented | `app/(app)/business-hub.tsx` |
| Reputation snapshot in app | Yes | Yes | Implemented | `app/(app)/business-reputation.tsx` |
| Full business analytics page on web | Yes | Yes | Implemented | `public/business-analytics.html` |
| Review metrics | Yes | Yes | Implemented | `app/(app)/business-reputation.tsx`, `public/business-hub.html`, `public/business-analytics.html` |
| Promotion metrics | Yes | Yes | Implemented | `app/(app)/business-hub.tsx`, `public/business-analytics.html`, `public/promotion-center.html` |
| Customer interest insights | No | Yes | Listed in upgrade copy, not clearly premium-gated in analytics code | `app/(app)/premium-upgrade.tsx` |
| Review management | No | Yes | Listed in upgrade copy, but review screens are business-gated rather than premium-gated | `app/(app)/premium-upgrade.tsx`, `app/(app)/business-reputation.tsx` |
| Featured placement | No | Yes | Implemented | `functions/src/index.ts`, `app/(app)/shoplocallist.tsx`, `public/serviceslist.html`, `public/businesslocallist.html` |
| Deals boost | No | Yes | Listed in upgrade copy; limited explicit gating found | `app/(app)/premium-upgrade.tsx` |
| Auto-feature services | No | Yes | Implemented | `functions/src/index.ts` |
| Premium badge / highlighted profile treatment | No | Yes | Implemented | `app/(app)/shoplocallist.tsx`, `app/(app)/businessprofile.tsx`, `public/business-profile.html` |
| Promotion plan differences | Limited | Expanded | Partially implemented | `public/promotion-center.html` |

## Analytics Available Today

### App Business Hub

The app business hub shows these analytics now:

- `Profile Views`
- `Active Listings`
- `Services`
- `Deals`
- `Active Promotions`
- `Unread Threads`
- `Average Rating`
- `Total Reviews`
- `Impressions`
- `Clicks`
- `Leads`
- `CTR`

Source:

- `app/(app)/business-hub.tsx`

### App Reputation Screen

The app reputation screen shows:

- `Average Rating`
- `Total Reviews`
- `New This Month`
- `Monthly Trend`

Source:

- `app/(app)/business-reputation.tsx`

### Web Business Analytics

The web analytics page is more detailed and currently includes:

- Profile views
- Approval status
- Verification status
- Listing totals / active / pending / total views
- Listing favorites / featured counts
- Job totals / active / expired / total views / posted this month
- Service totals / approved / pending / featured / service views
- Deal totals / active / pending / total views
- Promotion impressions / clicks / leads / CTR

Source:

- `public/business-analytics.html`

### Web Business Hub

The web business hub also includes rolling/trend-style metrics:

- `All-Time Views`
- `7-Day Views`
- `30-Day Views`
- `Trend`
- `New Reviews This Month`
- `Monthly Review Trend`
- lead/inbox snapshot

Source:

- `public/business-hub.html`

## Premium Differences Actually Wired Today

These are the clearest premium behaviors that are implemented now.

### 1. Premium account state is real

Premium activation updates user records with fields like:

- `businessTier: "premium"`
- `isPremium: true`
- `premiumStatus: "active"`

Source:

- `functions/src/index.ts`

### 2. Premium gets featured visibility treatment

Premium businesses are surfaced as highlighted/featured in business discovery and profile UI.

Source:

- `app/(app)/shoplocallist.tsx`
- `app/(app)/businessprofile.tsx`
- `public/business-profile.html`
- `public/businesslocallist.html`

### 3. Premium services are auto-featured

There is explicit backend logic that auto-features services for premium business users.

Source:

- `functions/src/index.ts`

### 4. Promotion flow recognizes free vs premium

The promotion center normalizes plan tier and has a free-plan limit constant:

- `FREE_ACTIVE_PROMOTION_LIMIT = 2`

That shows plan-aware logic exists, although the page does not currently expose a separate premium analytics layer.

Source:

- `public/promotion-center.html`

## Gaps Between Copy And Implementation

The premium upgrade page currently promises:

- `Basic analytics` for free and premium
- `Customer interest insights` for premium only
- `Review management` for premium only
- `Featured placement` for premium only
- `Deals boost` for premium only

Source:

- `app/(app)/premium-upgrade.tsx`

But the code today suggests:

- `Basic analytics` is true for both
- `Featured placement` is clearly true for premium
- `Customer interest insights` is only partially reflected by existing promotion/lead metrics
- `Review management` is not clearly premium-gated yet
- `Deeper analytics` is more marketing copy than enforced access control right now

## Recommendation

If you want the product behavior to match the current premium copy, the cleanest next step would be to explicitly decide one of these:

1. Keep analytics available to all business users and update the premium copy to emphasize visibility and promotion perks.
2. Introduce true premium-gated analytics, such as:
   - rolling historical trends in the app
   - buyer/lead breakdowns
   - listing favorites and featured performance
   - advanced promotion analytics
   - job/service/deal analytics split in the native app

Right now, the repo is closer to option 1 than option 2.
