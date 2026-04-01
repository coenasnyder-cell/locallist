# Stripe Featured Listing Payment Integration

## Overview

This setup implements a two-step process for featured listings:

1. **Payment Step**: User pays via Stripe → listing marked as `featurePaymentStatus: "paid"`
2. **Approval Step**: Admin approves listing → featured status activates (`isFeatured: true`)

This ensures featured listings only go live after admin moderation.

---

## Cloud Functions

### 1. `handleStripeCheckout` (HTTPS webhook)
- **Endpoint**: `https://us-central1-local-list-wski21.cloudfunctions.net/handleStripeCheckout`
- **Trigger**: Stripe webhook event `checkout.session.completed`
- **Action**:
  - Receives Stripe checkout session
  - Updates listing document with:
    ```javascript
    {
      featurePaymentStatus: "paid",
      featureRequested: true,
      featurePaymentDate: "<ISO string>",
      updatedAt: "<ISO string>"
    }
    ```
  - **Does NOT** set `isFeatured` to true

### 2. `onListingApproved` (Firestore trigger)
- **Trigger**: When `listings` document status changes to `"approved"`
- **Checks**: If `featurePaymentStatus === "paid"`
- **Action** (if payment confirmed):
  - Sets `isFeatured: true`
  - Sets `featureExpiresAt` to 7 days from now
  - Increments user's `featurePurchases` counter by 1
  - Logs activation timestamp

### 3. `expireFeaturedListings` (Scheduled)
- **Schedule**: Daily at 2:00 AM UTC
- **Action**: Auto-demotes expired featured listings

---

## Setup Instructions

### Step 1: Configure Stripe Webhook Secret

Add your Stripe webhook signing secret as a Firebase secret:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste your Stripe webhook signing secret when prompted
```

Find your secret in Stripe Dashboard:
- Go to **Developers** → **Webhooks**
- Click on your endpoint URL
- Find "Signing secret" under "Configuration"
- Copy the secret starting with `whsec_`

### Step 2: Configure Stripe Webhook in Dashboard

1. Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: (get after deployment)
4. Listen to events: Select `checkout.session.completed`
5. Copy the signing secret and set it as shown in Step 1

### Step 3: Update Client-Side Checkout

When creating a Stripe Checkout Session, include listing ID in metadata:

```javascript
// In your create-listing.html or wherever you create Stripe sessions
const session = await stripe.checkout.sessions.create({
  line_items: [...],
  success_url: `${YOUR_DOMAIN}/success`,
  cancel_url: `${YOUR_DOMAIN}/cancel`,
  metadata: {
    listingId: listingId  // Add this
  }
});
```

### Step 4: Deploy Functions

```bash
firebase deploy --only functions
```

---

## Data Flow

### Featured Listing Creation with Payment

```
User Creates Listing + Selects "Featured" Option
        ↓
User Completes Stripe Checkout
        ↓
Stripe Event: checkout.session.completed
        ↓
handleStripeCheckout() triggered
        ↓
Update Listing:
  - featurePaymentStatus: "paid"
  - featureRequested: true
  - featurePaymentDate: <timestamp>
        ↓
Listing in PENDING state, awaiting admin approval
        ↓
Admin Approves Listing (changes status to "approved")
        ↓
onListingApproved() triggered
        ↓
Check: featurePaymentStatus === "paid"?
        ↓
YES → Activate Featured:
  - isFeatured: true
  - featureExpiresAt: +7 days
  - featurePurchases++
        ↓
Featured Listing Appears on Homepage & Featured Listings Page
        ↓
7 Days Pass
        ↓
expireFeaturedListings() scheduled function runs
        ↓
Auto Demote:
  - isFeatured: false
  - featureExpiresAt: deleted
```

---

## Firestore Schema

### Listings Collection

```javascript
{
  id: "listing_123",
  title: "...",
  status: "approved" | "pending" | "rejected",
  
  // Feature fields
  featureRequested: true,              // User wants it featured
  featurePaymentStatus: "paid" | "pending" | "failed",
  featurePaymentDate: "2026-02-27T...",
  featureActivatedDate: "2026-02-27T...",
  isFeatured: true,                    // Only set after approval
  featureExpiresAt: "2026-03-06T...",  // 7 days from activation
  
  // Other fields
  userId: "user_456",
  createdAt: "...",
  updatedAt: "..."
}
```

### Users Collection

```javascript
{
  id: "user_456",
  email: "user@example.com",
  featurePurchases: 3,  // Incremented on activation
  ...
}
```

---

## Testing

### Test Webhook Locally

Use Stripe CLI to forward webhooks to your local function:

```bash
stripe listen --forward-to localhost:5001/local-list-wski21/us-central1/handleStripeCheckout
```

### Manual Test

1. Create a listing with featured option
2. Complete Stripe checkout with test card: `4242 4242 4242 4242`
3. Check Firestore: listing should have `featurePaymentStatus: "paid"`
4. Admin approves listing: `status` → `"approved"`
5. Check Firestore: `isFeatured` should now be `true` and `featureExpiresAt` should be set

---

## Admin Panel Updates

Your admin panel's listing approval function should now:

1. **On status change to "approved"**:
   - The `onListingApproved()` function handles featured activation automatically
   - No need to manually set `isFeatured` in the admin UI

2. **Optional**: Add a column showing payment status in admin panel:
   ```javascript
   const paymentStatus = listing.featurePaymentStatus; // "paid" | "pending" | "failed"
   const isFeatured = listing.isFeatured; // Only true after approval + payment
   ```

---

## Migration from Old System

If you had listings with immediate `isFeatured: true` on payment:

```bash
# Document the old listings in a migration script
# For existing approved listings with featurePaymentStatus, manually set:
# - featureActivatedDate: <when they were approved>
# - featureExpiresAt: <activation date + 7 days>
```

---

## Error Handling

- **Missing Stripe signature**: Returns 400
- **Missing listing ID in metadata**: Returns 400 
- **Firestore update fails**: Logs error, webhook marked as failed (Stripe retries)
- **Feature payment conflicts**: onListingApproved checks `featurePaymentStatus` first

---

## Support

For issues:
1. Check Cloud Functions logs: `firebase functions:log`
2. Check Stripe webhook delivery logs: Developers → Webhooks → Your endpoint
3. Verify Firestore documents have correct structure

