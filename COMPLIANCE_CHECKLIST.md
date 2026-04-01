# Compliance Checklist - Step 6

Complete all items before App Store and Google Play submission.

---

## Legal & Privacy

### Privacy Policy ✅
- [ ] Privacy policy document created (Google Docs or legal template)
- [ ] Covers:
  - [ ] What data is collected (email, name, location)
  - [ ] How data is used (authentication, listings, analytics)
  - [ ] How data is stored (Firebase Firestore, secure)
  - [ ] User rights (view, delete, export)
  - [ ] Third-party services (Firebase, Stripe, Google Analytics)
  - [ ] Children's privacy (no COPPA violations)
- [ ] Published at public URL (e.g., https://myapp.com/privacy)
- [ ] Accessible within app (Settings → Privacy Policy)

### Terms of Service ✅
- [ ] Terms of Service document created
- [ ] Covers:
  - [ ] User responsibilities (no illegal content)
  - [ ] Listing restrictions (no weapons, drugs, adult content)
  - [ ] Payment terms (featured listing pricing, refund policy)
  - [ ] Account suspension/termination conditions
  - [ ] Limitation of liability
  - [ ] Dispute resolution (if applicable)
- [ ] Published at public URL
- [ ] Accessible within app (Settings → Terms of Service)

### GDPR Compliance (if EU users) ✅
- [ ] Can view personal data (Settings → Download My Data)
- [ ] Can delete account and all associated data
- [ ] Data deletion completed within 30 days
- [ ] Legal basis documented for data processing
- [ ] Data processing agreement with Firebase (provided by Google)

### CCPA Compliance (if California users) ✅
- [ ] Privacy Policy includes CCPA rights
- [ ] Users can request data deletion
- [ ] Users can opt-out of "sale" of personal data (if applicable)
- [ ] Privacy notice provided before data collection

---

## Payment Processing (Stripe)

### PCI Compliance ✅
- [ ] Using Stripe Checkout (not storing card data directly)
- [ ] No unencrypted card data in logs
- [ ] HTTPS enforced for all payment endpoints
- [ ] Server-side validation of payment amounts
- [ ] Payment webhook securely verified with signing secret

### Stripe Setup ✅
- [ ] Stripe account created (not test account)
- [ ] Live API keys configured (not test keys)
- [ ] Webhook endpoint registered:
  - URL: `https://your-backend.com/webhook`
  - Events: `payment_intent.succeeded`, `payment_intent.failed`
  - Signing secret stored in environment variables
- [ ] Refund policy documented
- [ ] Customer support email configured in Stripe dashboard

### Payment Error Handling ✅
- [ ] Failed payments show clear error message
- [ ] Users can retry payment
- [ ] No double-charging on network failures
- [ ] Payment receipt emailed to user
- [ ] Disputed transactions handled (Stripe dashboard)

---

## App Store Guidelines

### iOS App Store ✅
**Review the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)**

- [ ] App doesn't crash on launch
- [ ] Clear, concise app description (< 170 chars)
- [ ] Privacy policy link included
- [ ] Screenshot for preview (showing main feature)
- [ ] Support email provided
- [ ] Keywords optimized for search
- [ ] No marketing materials in app settings
- [ ] Age rating appropriate (typically 4+)
- [ ] Licensed music/assets (no copyright violations)
- [ ] No referral links to competitors
- [ ] Works on iPhone 13 and newer (test on actual devices)

### Google Play Store ✅
**Review the [Google Play Policies](https://play.google.com/about/developer-content-policy/)**

- [ ] App doesn't crash on launch
- [ ] Short description (< 80 chars)
- [ ] Full description clear and accurate
- [ ] Privacy policy link required
- [ ] Screenshots showing key features (min 2)
- [ ] Feature graphic (1024x500 px)
- [ ] Support email/URL provided
- [ ] Content rating questionnaire completed
- [ ] Target API level ≥ 33 (Google Play minimum)
- [ ] App installs and runs smoothly
- [ ] No malware or security vulnerabilities
- [ ] No misleading content

---

## Content Moderation

### User-Generated Content Policy ✅
- [ ] Prohibited content clearly defined:
  - Weapons, explosives
  - Illegal drugs
  - Adult/sexual content
  - Hateful speech
  - Misinformation
  - Copyright violations
- [ ] Reporting mechanism (report button on listings)
- [ ] Admin review queue implemented
- [ ] Automated filters for keywords (if applicable)
- [ ] Consequences for violations (warning → suspension → ban)

### Moderation Workflow ✅
- [ ] Reported listings queue in admin panel
- [ ] Admin can view reported content
- [ ] Admin can approve, reject, or request changes
- [ ] User notified of moderation decision
- [ ] Appeal mechanism for users
- [ ] Moderation logs maintained for legal proof

---

## Data Security

### Encryption ✅
- [ ] All data in transit uses HTTPS (enforced)
- [ ] Firebase Firestore encryption at rest (default)
- [ ] User passwords hashed (Firebase Auth handles)
- [ ] No sensitive data in logs (payment details, SSNs, etc.)

### Authentication ✅
- [ ] Email/password auth requires confirmation
- [ ] Google OAuth properly configured
- [ ] Session tokens expire (Firebase handles)
- [ ] No stored credentials in code/comments
- [ ] Rate limiting on login attempts (if custom backend)

### Third-Party Services ✅
- [ ] Firebase Trust & Safety reviewed
- [ ] Stripe security compliance verified
- [ ] No unnecessary third-party SDKs

---

## Accessibility (WCAG 2.1 Level A)

### Mobile Accessibility ✅
- [ ] Text contrast ratio ≥ 4.5:1 for small text
- [ ] Touch targets ≥ 48x48 dp (iOS) / 48x48 dp (Android)
- [ ] Screen reader compatible (iOS VoiceOver, Android TalkBack)
  - [ ] Labels on all buttons and images
  - [ ] Form fields have labels
  - [ ] Error messages announced
- [ ] Color not sole indicator (e.g., red error + exclamation icon)
- [ ] No flashing/strobing content
- [ ] Text size adjustable without loss of functionality

### Testing ✅
- [ ] Tested with iOS VoiceOver enabled
- [ ] Tested with Android TalkBack enabled
- [ ] Keyboard navigation works (if applicable)
- [ ] No crashes when using accessibility features

---

## Performance & Reliability

### Minimum Device Support ✅
- [ ] iOS: 13.1 minimum (or higher based on business decision)
- [ ] Android: API level 24 minimum
- [ ] Tested on low-end devices (2GB RAM)
- [ ] Works on networks with latency (3G + throttling)

### Crash & Error Handling ✅
- [ ] Crash rate < 0.5% (acceptable)
- [ ] No unhandled exceptions in production
- [ ] Graceful fallbacks for failed API calls
- [ ] Offline mode gracefully degrades (if applicable)

---

## Testing Completeness

### Manual Testing ✅
- [ ] iOS: Tested on iPhone XS or newer
- [ ] Android: Tested on Android 6.0 or newer
- [ ] Both orientations (portrait & landscape)
- [ ] Dark & light mode
- [ ] Various network speeds (WiFi, 4G, 3G throttled)

### Unit & Integration Tests ✅
- [ ] Firebase auth tested
- [ ] Firestore queries tested
- [ ] Form validation tested
- [ ] Analytics events tested
- [ ] Payment flow tested (test Stripe account)

---

## Launch Readiness Sign-Off

### Engineering ✅
- [ ] Tech Lead reviews: `npm run quality:check` passes
- [ ] All TypeScript errors resolved
- [ ] All ESLint warnings reviewed
- [ ] Performance baselines met
- [ ] No unresolved GitHub issues

### Product ✅
- [ ] Product Manager approves feature set
- [ ] Acceptance criteria for all user flows met
- [ ] No critical bugs or missing features
- [ ] Analytics & tracking verified

### Legal/Compliance ✅
- [ ] Legal counsel reviews privacy policy
- [ ] GDPR/CCPA compliance verified
- [ ] Content moderation policy in place
- [ ] Payment processing secure & compliant

### Marketing ✅
- [ ] App Store graphics finalized
- [ ] Marketing copy reviewed
- [ ] Social media announcement ready
- [ ] Press release (if applicable)

---

## Final Approval

```
Engineering Lead:        ________________    Date: ________
Product Manager:         ________________    Date: ________
Legal/Compliance:        ________________    Date: ________

✓ APPROVED FOR PRODUCTION RELEASE
```

---

## Post-Launch Monitoring (First 30 Days)

- [ ] Daily crash reports reviewed
- [ ] User feedback monitored
- [ ] Performance metrics tracked
- [ ] Content moderation queue monitored
- [ ] Payment issues tracked
- [ ] Legal compliance maintained (GDPR data deletion, etc.)

**If issues found:** Create hotfix, re-test, resubmit following RELEASE_CHECKLIST.md
