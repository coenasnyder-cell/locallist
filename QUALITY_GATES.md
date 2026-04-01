# Quality Gates & Performance Testing Strategy

## Overview

Quality gates ensure your app meets production standards before release. This document defines:
- **Code Quality Gates:** TypeScript, ESLint, bundle size
- **Performance Benchmarks:** App startup, Firestore query latency, memory usage
- **Functional Testing:** Critical user flows
- **Release Validation:** Pre-launch checklist

---

## Part 1: Code Quality Gates

### 1.1 TypeScript Compilation

All code must pass strict TypeScript checking.

```bash
# Check TypeScript errors (CI/pre-commit)
npm run type-check

# Fix common TypeScript issues
npm run type-check:fix
```

**Gate Threshold:** 0 errors

**What It Catches:**
- Type mismatches (e.g., passing string where number expected)
- Undefined variable access (e.g., calling method on null)
- Missing function arguments
- Incompatible prop types

---

### 1.2 ESLint Code Quality

Enforces code style, best practices, and common errors.

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

**Gate Threshold:** 0 errors, ≤ 10 warnings

**Critical Rules:**
- `no-console` (warning) — Remove debug logs before production
- `no-debugger` (error) — Debugger statements forbidden
- `react-hooks/rules-of-hooks` (error) — Rules of hooks violations
- `prefer-const` (warning) — Use const instead of let when value doesn't change
- `no-unused-vars` (error) — Remove unused variables/imports

---

### 1.3 Bundle Size

Larger bundles = slower app startup and higher data usage.

```bash
# Analyze bundle size
npm run bundle-analyze
```

**Gate Thresholds:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Main bundle | ≤ 250 KB (gzipped) | ⛔ Fail if exceeded |
| Total JS | ≤ 500 KB (gzipped) | ⚠️ Warn if exceeded |
| Native bundle (Android) | ≤ 80 MB | ❌ Fail if exceeded |
| Native bundle (iOS) | ≤ 100 MB | ❌ Fail if exceeded |

**Optimization Tips:**
- Code split by route (Expo Router does this automatically)
- Lazy load heavy libraries (Firebase Auth, Storage)
- Tree-shake unused dependencies
- Compress assets

---

## Part 2: Performance Benchmarks

### 2.1 App Startup Time

**Metric:** Time from launch until home screen is interactive

**Target:** ≤ 3 seconds (cold start)

**How to Measure:**
```bash
# Use React DevTools Profiler
# 1. Run app in development
# 2. Press Shift+M to open Profiler
# 3. Record startup → check "App Initialized" duration
```

**Critical Path:**
```
App Launch (0ms)
  ↓
Firebase Init (0-500ms) ← Environment check, credentials load
  ↓
Auth Service Init (500-1000ms) ← Check if user is logged in
  ↓
Home Screen Render (1000-2000ms) ← Featured listings load
  ↓
Interactive (2000-3000ms) ← User can tap buttons
```

### 2.2 Listing Creation Flow

**Metric:** Time from opening form → successful submission

**Target:** ≤ 4 seconds (including Stripe checkout if featured)

**Benchmark:**
- Form renders: ≤ 500ms
- Draft autosave: ≤ 200ms (debounced)
- Submit to Firestore: ≤ 2000ms
- Featured checkout: ≤ 3000ms

**Performance Profile:**
```bash
# In CreateListing.tsx, wrap key operations:
console.time('listing-submit');
await addDoc(collection(db, 'listings'), listingData);
console.timeEnd('listing-submit');
```

### 2.3 Firestore Query Latency

**Metric:** Round-trip time for Firestore queries

**Target:** ≤ 500ms for reads, ≤ 1000ms for writes

**Queries to Monitor:**
- Get user profile: ≤ 200ms
- List featured listings: ≤ 300ms
- Search by zipcode: ≤ 400ms
- Create listing: ≤ 800ms
- Update analytics event: ≤ 500ms

**Optimization:**
- Index queries on common filters (user_id, zipcode, status)
- Limit documents returned (`.limit(20)`)
- Use Firestore caching to avoid redundant queries

### 2.4 Memory Usage

**Metric:** RAM consumed by app

**Target:** ≤ 150 MB (Android), ≤ 200 MB (iOS)

**Check via:**
- Android: Android Studio → Profiler tab
- iOS: Xcode → Debug Navigator → Memory
- React Native: `console.log(Platform.OS === 'ios' ? /* ... */)` 

**Common Leaks:**
- Event listeners not cleaned up in useEffect cleanup
- Large image arrays cached in state
- Unsubscribed Firestore listeners

---

## Part 3: Functional Testing

### 3.1 Critical User Flows

Every critical flow must be manually tested before release:

#### ✅ Authentication Flow
```
1. Sign up with email & password
✓ Confirm email verification email sent
✓ Click link, verification succeeds
✓ Can now log in with credentials

2. Sign in with Google
✓ Click "Sign in with Google"
✓ Google OAuth dialog appears
✓ After consent, user is logged in
✓ User profile created in Firestore
```

#### ✅ Create & List Listing (Main Funnel)
```
1. Tap "Post Your First Listing" CTA
✓ Routes to signup if not signed in
✓ Preserves returnTo intent
✓ After signup, returns to form

2. Fill listing form
✓ Form fields validate on blur
✓ Draft autosaves every 500ms
✓ "Draft Saved" indicator shows briefly
✓ Clear Draft button removes saved state

3. Submit listing
✓ Form validates all required fields
✓ Spinner shows during upload
✓ Analytics event fires: listing_submitted
✓ Success page shows (listing_posted.tsx)
✓ Listing appears in public browse view
```

#### ✅ Featured Listing Purchase
```
1. Check "Make it Featured" checkbox
✓ Upgrade modal appears
✓ Price and terms visible
✓ Stripe checkout button enabled

2. Click "Upgrade to Featured"
✓ Analytics event: featured_checkout_started
✓ Stripe checkout opens
✓ Accept test card: 4242 4242 4242 4242

3. Complete payment
✓ "Processing..." spinner shows
✓ Dialog closes
✓ Listing marked as featured
✓ Analytics event: featured_checkout_success fires
```

#### ✅ Browse Marketplace
```
1. Home screen loads
✓ Featured listings carousel visible
✓ Featured listings have "Featured" badge
✓ Scroll performance is smooth (60 FPS)

2. Tap listing
✓ SingleListing.tsx opens with details
✓ Images load (≤ 500ms)
✓ Contact vendor/inquiry flow works

3. Filter by category
✓ Category filter updates listings
✓ Query completes ≤ 400ms
✓ No lag when scrolling 100+ listings
```

---

## Part 4: Release Validation Checklist

### Pre-Release (48 Hours Before)

- [ ] **Build Test Passes**
  ```bash
  npm run type-check
  npm run lint
  npm run eas:build:preview:android
  ```
  Result: 0 errors, build completes ✓

- [ ] **Performance Baseline**
  - [ ] Cold startup: ≤ 3 seconds
  - [ ] ListCreate submit: ≤ 4 seconds
  - [ ] Memory at idle: ≤ 150 MB
  - [ ] Bundle size acceptable

- [ ] **Critical Flows on Device**
  - [ ] Sign up → first listing in < 2 min
  - [ ] Draft autosave works
  - [ ] Featured purchase flow completes
  - [ ] Browse & search works
  - [ ] No app crashes during testing

- [ ] **Analytics Instrumentation**
  ```bash
  # Check dev Firebase project
  # Create test listing
  # Verify appAnalyticsEvents collection has 6+ events
  - first_listing_cta_tap
  - listing_form_started
  - listing_draft_restored
  - listing_submitted
  - featured_checkout_started
  - featured_checkout_success
  ```

- [ ] **Network Conditions**
  - [ ] Test on 3G (throttle network in DevTools)
  - [ ] App doesn't crash
  - [ ] Gracefully handles slow Firestore queries
  - [ ] Error messages display clearly

- [ ] **Permissions Check**
  - [ ] Android: Camera, Gallery, Location requested correctly
  - [ ] iOS: Photo Library usage description appears
  - [ ] No app crashes on permission denial

### 24 Hours Before Release

- [ ] **Create Production Build**
  ```bash
  npm run eas:build:prod:ios
  npm run eas:build:prod:android
  ```
  Result: Both builds complete, provisioning profiles valid ✓

- [ ] **Test Production Builds**
  - [ ] Install APK/IPA on real device (not emulator)
  - [ ] Run through all critical flows
  - [ ] Verify connects to production Firebase (not dev)
  - [ ] Check analytics events appear in production project

- [ ] **Firestore Rules Review**
  - [ ] Rules allow authenticated writes to appAnalyticsEvents
  - [ ] Listing creation rules are correct
  - [ ] Auth rules prevent unauthorized access
  - [ ] Test read/write simulations pass

- [ ] **Environment Check**
  ```bash
  # Verify production credentials
  grep "local-list-wski21" firebase.ts
  grep "PROD_FIREBASE" eas.json
  ```

### Release Day

- [ ] **Final Device Test**
  - [ ] Full critical flow on both Android & iOS
  - [ ] Screenshot for marketing if needed

- [ ] **Submit to Stores**
  ```bash
  # iOS App Store
  npm run eas:build:prod:ios --auto-submit

  # Google Play
  npm run eas:build:prod:android --auto-submit
  ```

- [ ] **Monitor Immediately After**
  - [ ] Check Firebase Analytics dashboard for events (analytics.google.com)
  - [ ] Check Firestore appAnalyticsEvents collection for tracking events
  - [ ] Monitor crash reports (Sentry, etc. if integrated)
  - [ ] Check Stripe dashboard for featured purchases

---

## Part 5: Performance Monitoring in Production

### Continuous Monitoring

Once live, track these metrics:

```typescript
// In utils/appAnalytics.ts, extend to include performance metrics:
export const trackPerformanceEvent = async (metric: string, value: number) => {
  await addDoc(collection(db, 'performanceMetrics'), {
    metric,
    value,
    platform: Platform.OS,
    timestamp: serverTimestamp(),
    userId: auth.currentUser?.uid || null
  });
};

// Track startup time
export const logAppStartup = (startTime: number) => {
  const duration = Date.now() - startTime;
  trackPerformanceEvent('app_startup_ms', duration);
};
```

### Dashboard Queries

Admin can query metrics:

```javascript
// View average startup time
db.collection('performanceMetrics')
  .where('metric', '==', 'app_startup_ms')
  .where('timestamp', '>', new Date(Date.now() - 7*24*60*60*1000)) // Last 7 days
  .get()
  .then(docs => {
    const times = docs.map(d => d.data().value);
    const avg = times.reduce((a, b) => a + b) / times.length;
    console.log(`Average startup: ${avg}ms`);
  });
```

### Red Flags (Immediate Action Required)

- Startup time > 5 seconds (user abandonment risk)
- Crash reports > 0.5% (major blocker)
- Featured purchase failures > 1% (revenue impact)
- Firestore query latency > 1000ms (UX degradation)

---

## Part 6: Running Quality Gate Checks

### Pre-Commit Hook (Optional)

```bash
# Install husky
npm install husky --save-dev
npx husky install

# Add pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
npm run type-check && npm run lint
EOF

chmod +x .husky/pre-commit
```

### CI/CD Integration

In your CI/CD pipeline (GitHub Actions, etc.):

```yaml
name: Quality Gates

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run bundle-analyze
      - name: Check bundle sizes
        run: |
          if [ $(stat -f%z dist/main.js 2>/dev/null || echo 0) -gt 250000 ]; then
            echo "❌ Bundle too large"
            exit 1
          fi
```

---

## Summary: Gate Thresholds Before Production Release

| Gate | Threshold | Command |
|------|-----------|---------|
| TypeScript Errors | 0 | `npm run type-check` |
| ESLint Errors | 0 | `npm run lint` |
| ESLint Warnings | ≤ 10 | `npm run lint` |
| Bundle Size (gzipped) | ≤ 250 KB | `npm run bundle-analyze` |
| Cold Startup | ≤ 3 sec | Manual test on device |
| Listing Submit | ≤ 4 sec | Manual test + timer |
| Critical Flows | 100% pass | Manual checklist |
| Crash Rate | < 0.1% | Monitor first 24h |

---

## Next: Step 6 - Compliance Checklist

Once quality gates pass, validate:
- GDPR data handling (user deletion, export)
- Payment processing (PCI compliance)
- App Store guidelines (both iOS & Android)
- Privacy policy & terms of service
