# Stripe Integration Setup Guide

## ✅ What's Been Completed

### Frontend Integration
- ✅ Stripe.js SDK added to create-listing.html
- ✅ Firebase Functions SDK added for Cloud Function calls
- ✅ Payment UI updated with Stripe checkout flow
- ✅ Success and cancel pages created
- ✅ Stripe config added to firebase-config.js

### Backend Integration  
- ✅ Stripe package added to Cloud Functions
- ✅ `createCheckoutSession` Cloud Function created
- ✅ `handleStripeCheckout` webhook handler ready
- ✅ `onListingApproved` trigger configured
- ✅ `expireFeaturedListings` scheduler configured

---

## 🔧 Required Setup Steps

### Step 1: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Sign up or log in to your account
3. Navigate to **Developers** → **API keys**
4. Copy your keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

> **Note:** Use test keys (`pk_test_` and `sk_test_`) for development. Use live keys only in production.

---

### Step 2: Configure Frontend with Publishable Key

Edit `public/firebase-config.js` and replace the placeholder with your actual publishable key:

```javascript
// Stripe configuration
const stripeConfig = {
  // Replace with your actual Stripe publishable key
  publishableKey: "pk_test_YOUR_ACTUAL_KEY_HERE"  // ← Update this line
};
```

**Example:**
```javascript
publishableKey: "pk_test_51Abc123..."
```

---

### Step 3: Configure Cloud Functions with Secret Key

Set your Stripe secret key as a Firebase secret:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

When prompted, paste your Stripe **secret key** (starts with `sk_test_` or `sk_live_`).

---

### Step 4: Set Up Stripe Webhook

#### 4.1 Deploy Your Functions First

```bash
# Install dependencies in functions directory
cd functions
npm install

# Return to root and deploy
cd ..
firebase deploy --only functions
```

After deployment, note the URL for `handleStripeCheckout`. It will look like:
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/handleStripeCheckout
```

#### 4.2 Configure Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL (the `handleStripeCheckout` function URL from above)
4. Under **Events to send**, select:
   - `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

#### 4.3 Set Webhook Secret in Firebase

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

When prompted, paste the webhook signing secret you just copied.

---

### Step 5: Update Base URL (Optional)

If your app is not hosted at `https://app.locallist.biz`, update the base URL in `functions/src/index.ts`:

Find this line in the `createCheckoutSession` function:
```typescript
const baseUrl = process.env.FUNCTIONS_EMULATOR === "true" 
  ? "http://localhost:5000" 
  : "https://app.locallist.biz";  // ← Update this URL
```

Change `https://app.locallist.biz` to your actual domain.

---

### Step 6: Redeploy Functions

After setting secrets and updating URLs:

```bash
firebase deploy --only functions
```

---

## 🧪 Testing Your Integration

### Test in Development Mode

1. **Start your app** locally
2. **Create a new listing** and check the "Feature this listing" checkbox
3. Click **Submit Listing**
4. You should be redirected to Stripe Checkout
5. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code
6. Complete the payment
7. You should be redirected to the success page
8. Check your listing in the database - it should have:
   ```javascript
   {
     featurePaymentStatus: "paid",
     featureRequested: true,
     featurePaymentDate: "2026-02-27T..."
   }
   ```

### Test Webhook Locally (Optional)

Use Stripe CLI to forward webhooks to your local functions:

```bash
stripe listen --forward-to http://localhost:5001/YOUR-PROJECT-ID/us-central1/handleStripeCheckout
```

---

## 📋 Payment Flow Summary

1. **User creates listing** with "Feature this listing" checked
2. **Listing is created** with `featurePaymentStatus: "pending"`
3. **User is redirected** to Stripe Checkout (via Cloud Function)
4. **User completes payment** with credit card
5. **Stripe sends webhook** to `handleStripeCheckout`
6. **Listing is updated** to `featurePaymentStatus: "paid"`
7. **Admin approves listing** → `status: "approved"`
8. **`onListingApproved` triggers** and checks payment status
9. **Featured is activated** → `isFeatured: true`, expires in 7 days
10. **After 7 days**, `expireFeaturedListings` removes featured status

---

## 🔒 Security Notes

- ✅ **Never expose your secret key** (`sk_test_` or `sk_live_`) in frontend code
- ✅ **Never trust client-side pricing** - all prices are set server-side in the Cloud Function
- ✅ **Webhook signature verification** is configured to prevent fraud
- ✅ **Payment metadata** includes listing ID for accurate tracking

---

## 🐛 Troubleshooting

### "Stripe is not configured" Error
- Check that `publishableKey` is set in `firebase-config.js`
- Verify the key starts with `pk_test_` or `pk_live_`

### Payment Redirects but No Database Update
- Check Cloud Functions logs: `firebase functions:log`
- Verify webhook secret is set: `firebase functions:secrets:access STRIPE_WEBHOOK_SECRET`
- Check Stripe webhook delivery in Dashboard → Webhooks → Click your endpoint

### "Failed to create checkout session" Error
- Verify secret key is set: `firebase functions:secrets:access STRIPE_SECRET_KEY`
- Check Cloud Functions logs for detailed error message

### Listing Not Featured After Admin Approval
- Verify `featurePaymentStatus` is `"paid"` in the listing document
- Check Cloud Functions logs for `onListingApproved` errors
- Ensure listing `status` changed from something other than `"approved"` to `"approved"`

---

## 📞 Support Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

---

## 🎉 You're All Set!

Once you complete the setup steps above, your Stripe integration will be fully functional. Users will be able to:
- Pay securely with credit/debit cards
- Get instant payment confirmation
- Have their listings featured after admin approval
- Enjoy 7 days of premium placement

Happy coding! 🚀
