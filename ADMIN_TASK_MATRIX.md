# Admin Task Matrix

This report reflects the admin surfaces currently wired in the codebase as of April 22, 2026.

## Summary

- Mobile app admin is a moderation-focused subset.
- Web admin is the full operations dashboard.
- Some admin React components exist in the repo but are not currently mounted in the mobile admin panel.

## App vs Web

| Task | Mobile App | Web Admin | Notes |
| --- | --- | --- | --- |
| Admin access gate | Yes | Yes | App uses `useAdminStatus`; web checks admin role before showing content. |
| Dashboard / action center | Yes | Yes | App has a simple action center; web has a full hub dashboard. |
| Pending user approvals | Yes | Yes | App: `AdminPendingApprovals`; web: `Pending Approvals` tab. |
| Pending business approvals | Yes | Yes | App: `AdminPendingBusinesses`; web: `Pending Business Profiles` tab. |
| Pending listing approvals | Yes | Yes | App: `AdminListings`; web: `Pending Listings` tab. |
| Reported listings | Yes | Yes | App bundles reports into one screen; web has a dedicated tab. |
| Reported messages | Yes | Yes | App bundles reports into one screen; web has a dedicated tab. |
| Combined reports view | Yes | Yes | App uses `AdminAllReports`; web has `Reports & Exports` plus moderation tabs. |
| Pending services moderation | No | Yes | Web has a dedicated `Pending Services` tab. |
| Featured listing purchase review | No | Yes | Web has a dedicated tab and approval workflow. |
| Featured service purchase review | No | Yes | Web has a dedicated tab and approval workflow. |
| Business claims review | No | Yes | Web includes a `Business Claims` section. |
| Verified businesses review/search | No | Yes | Web includes a `Verified Businesses` tab. |
| Business users list | No | Yes | Web has a dedicated `Business Users` tab. |
| Blocked users management | No | Yes | Web has a `Blocked Users` tab. |
| Community/site settings | No | Yes | Web exposes settings forms for site/community configuration. |
| Shop local section settings | No | Yes | Web has a dedicated local section settings tab. |
| Analytics dashboard | No | Yes | Web includes analytics, app funnel, and counts. |
| CSV exports / reports | No | Yes | Web exports users, business users, purchases, and service listings. |
| Auto-approval tools | No | Yes | Web includes an `Auto Approvals` tab. |

## Mobile Admin Entry

The mobile admin entry is:

- `app/admin.tsx`
- `app/(app)/admin-panel.tsx`

The current mobile panel exposes:

- `Pending Users`
- `Pending Businesses`
- `Pending Listings`
- `Reports`

Those actions are surfaced by:

- `components/AdminMobileActionCenter.tsx`
- `components/AdminPendingApprovals.tsx`
- `components/AdminPendingBusinesses.tsx`
- `components/AdminListings.tsx`
- `components/AdminAllReports.tsx`

## Web Admin Entry

The web admin entry is:

- `public/admin.html`
- `public/admin.js`

The web admin currently includes broader operations coverage, including:

- Analytics
- Pending Listings
- Pending Services
- Reported Listings
- Reported Messages
- Business Users
- Featured Listing Purchases
- Featured Service Purchases
- Business Claims
- Verified Businesses
- Pending Business Profiles
- Local Section Settings
- Site Settings
- Pending Approvals
- Blocked Users
- Reports & Exports
- Auto Approvals

## Admin React Components Present But Not Mounted In Mobile Panel

These components exist in the React codebase but are not currently wired into `app/(app)/admin-panel.tsx`:

- `components/AdminAnalytics.tsx`
- `components/AdminFeaturePurchases.tsx`
- `components/AdminSiteSettings.tsx`
- `components/AdminUsers.tsx`
- `components/AdminUsersList.tsx`
- `components/AdminPendingListings.tsx`
- `components/AdminReportedListings.tsx`
- `components/AdminReportedMessages.tsx`

## Key Source Files

- `app/admin.tsx`
- `app/(app)/admin-panel.tsx`
- `components/AdminMobileActionCenter.tsx`
- `components/AdminPendingApprovals.tsx`
- `components/AdminPendingBusinesses.tsx`
- `components/AdminListings.tsx`
- `components/AdminAllReports.tsx`
- `public/admin.html`
- `public/admin.js`
