# Pre-Release Validation Checklist

Use this checklist before submitting to App Store and Google Play.

## 48 Hours Before Release

### Code Quality ✅
```bash
npm run quality:check    # TypeScript + ESLint
npm run test             # Unit tests
```
- [ ] All TypeScript errors resolved
- [ ] ESLint errors: 0
- [ ] ESLint warnings: ≤ 10
- [ ] All unit tests pass

### Build Verification ✅
```bash
npm run eas:build:preview:android
npm run eas:build:preview:ios
```
- [ ] Android build succeeds
- [ ] iOS build succeeds
- [ ] No provisioning profile errors

### Performance Baseline ✅
**On real device (not emulator):**
- [ ] Cold startup: ≤ 3 seconds
- [ ] First listing creation: ≤ 4 seconds
- [ ] Memory usage: ≤ 150 MB (Android), ≤ 200 MB (iOS)
- [ ] No jank when scrolling 100+ listings

### Critical User Flows ✅
**Test on both Android and iOS:**

#### Sign Up Flow
- [ ] Can create account with email
- [ ] Confirmation email sent
- [ ] Can verify email with link
- [ ] Can sign in with verified account

#### Sign In with Google
- [ ] Google auth flow works
- [ ] User profile created in Firestore
- [ ] Previously uploaded data syncs

#### Create Listing (Main Flow)
1. Home screen → CTA visible
2. Click "Post Your First Listing"
   - [ ] Non-signed-in users routed to signup
   - [ ] Signed-in users skip to form
3. Fill form
   - [ ] All fields validate correctly
   - [ ] Draft autosaves (check browser/device storage)
   - [ ] Clear Draft button works
4. Submit
   - [ ] Upload spinner shows
   - [ ] Success screen appears
   - [ ] Listing appears in browse view
   - [ ] appAnalyticsEvents fired in Firestore

#### Browse Marketplace
- [ ] Featured listings carousel loads
- [ ] Listings have featured badge
- [ ] Lazy scroll 100+ listings smoothly
- [ ] Tap listing → detail view
- [ ] Filter by category works
- [ ] Search by zip code works

#### Featured Listing Upgrade
- [ ] Check "Make it Featured"
- [ ] Stripe modal appears
- [ ] Test card: `4242 4242 4242 4242` (Exp: 12/26, CVC: 123)
- [ ] Payment succeeds
- [ ] Listing marked as featured
- [ ] Featured event logged in Firestore

### Analytics Verification ✅
**Using preview/dev build:**
```bash
# In Firestore Console, check appAnalyticsEvents collection:
```
- [ ] first_listing_cta_tap events recorded
- [ ] listing_form_started events recorded
- [ ] listing_submitted events recorded
- [ ] featured_checkout_success events recorded
- [ ] All events have valid timestamp & platform

### Network Resilience ✅
**Throttle network to 3G in dev tools:**
- [ ] App doesn't crash on slow network
- [ ] Firestore operations retry gracefully
- [ ] Listing upload shows timeout error if ≥ 30s

### Permissions ✅
- [ ] Android: Camera permission request appears
- [ ] Android: Gallery permission request appears
- [ ] iOS: "Photos" permission prompt appears
- [ ] App doesn't crash if user denies permissions

### Device Testing ✅
**Test on:**
- [ ] Android phone (latest major version)
- [ ] Android tablet (if applicable)
- [ ] iPhone (latest major version)
- [ ] iPhone (one major version older)

---

## 24 Hours Before Release

### Production Build ✅
```bash
npm run eas:build:prod:android
npm run eas:build:prod:ios
```
- [ ] Android build succeeds
- [ ] iOS build succeeds
- [ ] Provisioning profiles valid
- [ ] No code signing errors

### Production Environment Check ✅
```bash
# Verify production Firebase config
grep -n "local-list-wski21" firebase.ts
```
- [ ] Firebase API keys are production
- [ ] Project ID: `local-list-wski21`
- [ ] Auth domain: `local-list-wski21.firebaseapp.com`

### Full Flow on Production App ✅
**Install production builds on real devices:**

1. Complete sign-up flow
2. Create a test listing (real data, you can delete later)
3. Verify data appears in production Firestore
4. Verify analytics events in production Firebase project

### Firestore Rules Validation ✅
**In Firebase Console:**
1. Go to **Firestore Database** → **Rules**
2. Click **Rules Playground**
3. Test read/write simulations:
   - [ ] Authenticated user can create listing
   - [ ] Authenticated user can write to appAnalyticsEvents
   - [ ] Unauthenticated user cannot write
   - [ ] Public can read listings

### Stripe Configuration ✅
**In Stripe Dashboard:**
- [ ] API keys are production (not test)
- [ ] Webhook endpoint configured for payment events
- [ ] Signing secret configured for local.html webhook handler

### Environment Secrets ✅
**In EAS Console:**
```bash
eas secret:list
```
- [ ] All EXPO_PUBLIC_PROD_FIREBASE_* secrets set
- [ ] All STRIPE_* secrets set (if applicable)
- [ ] No test/dev credentials in production secrets

---

## Release Day

### Final Sanity Check ✅
**30 minutes before submission:**
- [ ] App opens and initializes
- [ ] Can sign in with test account
- [ ] Can create listing
- [ ] No error messages in console
- [ ] App doesn't crash on home screen

### App Store Submission (iOS) ✅
```bash
npm run eas:build:prod:ios --auto-submit
```
- [ ] Build submitted successfully
- [ ] Monitor for review queue position
- [ ] Expected review time: 24-48 hours

### Google Play Submission (Android) ✅
```bash
npm run eas:build:prod:android --auto-submit
```
- [ ] Build uploaded successfully
- [ ] Release track set to Internal Testing
- [ ] Roll out to 10% of users initially (not 100%)

### Real-Time Monitoring ✅
**First 2 hours after release:**
- [ ] Check Sentry/crash reports for new errors
- [ ] Check Firebase Analytics for events
- [ ] Check Stripe Dashboard for payment issues
- [ ] Monitor user feedback/reviews

### Rollback Plan ✅
If critical issues found:
1. Stop rollout immediately (set to 0%)
2. Create hotfix branch
3. Run `npm run quality:check`
4. Re-test critical flows
5. Rebuild and resubmit

---

## Post-Release (First 24 Hours)

### Monitor Key Metrics ✅
- [ ] Crash rate < 0.1%
- [ ] App startup < 3s
- [ ] Featured purchase conversion > 0.5%
- [ ] No unhandled exceptions in Firestore

### Gradual Rollout ✅
- [ ] 10% through all users (if no crashes)
- [ ] 50% after 4 hours
- [ ] 100% after 12 hours

### User Feedback ✅
- [ ] Monitor app store reviews
- [ ] Respond to critical issues
- [ ] Track support emails

---

## Troubleshooting During Release

### App Crashes on Startup
1. Check Sentry for crash stack trace
2. Likely causes:
   - Wrong Firebase credentials
   - Missing environment variable
   - Corrupted app bundle

**Fix:** Re-run `npm run quality:check`, rebuild, resubmit

### Stripe Payments Failing
1. Check Stripe Dashboard → Events → payment_intent.failed
2. Likely causes:
   - API key mismatch
   - Webhook not configured
   - Region restrictions

**Fix:** Verify `STRIPE_SECRET_KEY` in EAS secrets, configure webhook

### Firestore Queries Timing Out
1. Check Firestore usage in Console
2. Likely causes:
   - Missing index on filtered field
   - Too many documents in collection
   - Slow network on device testing

**Fix:** Create Firestore index, test on real 4G/LTE

---

## Sign-Off

- [ ] Tech Lead: Quality gates passed
- [ ] Product Owner: Feature completeness approved
- [ ] QA: All flows tested on devices
- [ ] Legal: Privacy policy & terms updated

**Ready for production release: ___________** (Date)
