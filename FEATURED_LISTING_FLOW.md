# Featured Listing Payment Flow - Implementation Guide

## Overview
This document outlines the complete featured listing payment system for Local List web version.

## Current Implementation Status ✅

### 1. Create Listing Page (`create-listing.html`)
- **UI Elements:**
  - ✅ Feature checkbox with pricing info ($5 for 7 days)
  - ✅ Payment instructions (Venmo, PayPal, Zelle) shown when checkbox is checked
  - ✅ Form submission creates `featurePurchases` record with status "pending"

### 2. Database Structure
- **featurePurchases Collection:**
  ```javascript
  {
    listingId: string,
    userId: string,
    amount: number,           // 5.0
    currency: string,          // "USD"
    status: string,            // "pending", "completed", "rejected"
    paymentMethod: string,     // "manual"
    purchasedAt: timestamp,
    expiresAt: string,         // ISO date string (7 days from purchase)
    notes: string,             // "Awaiting payment verification"
    verifiedAt: timestamp,     // Added when admin approves
    rejectedAt: timestamp,     // Added when admin rejects
    rejectionReason: string    // Reason for rejection
  }
  ```

- **listings Collection (existing fields):**
  - `isFeatured: boolean` - Set to true when payment approved
  - `featureExpiresAt: string` - ISO date when featured status expires

### 3. Admin Panel (`admin.html` & `admin.js`)
- **Feature Purchases Tab:**
  - ✅ Lists all feature purchases (pending, completed, rejected)
  - ✅ Shows listing title, user name, amount, dates, payment method
  - ✅ Color-coded status badges
  - ✅ Approve/Reject buttons for pending purchases
  - ✅ Refresh button to reload data

## Payment Flow

### User Flow:
1. **Create Listing:**
   - User fills out listing form
   - Checks "Feature this listing" checkbox
   - Payment instructions appear (Venmo/PayPal/Zelle)
   - User submits listing

2. **Payment:**
   - Listing created with `isFeatured: false`
   - `featurePurchases` record created with `status: "pending"`
   - User sees message: "Please complete payment to activate featured status"
   - User sends $5 via Venmo/PayPal/Zelle with listing title in notes
   - User redirected to profile after 3 seconds

### Admin Flow:
1. **Payment Verification:**
   - Admin logs into admin panel
   - Clicks "Feature Purchases" tab
   - Reviews pending purchases
   - Verifies payment received via Venmo/PayPal/Zelle
   - Clicks "✓ Approve" button

2. **Approval:**
   - `featurePurchases` document updated:
     - `status: "completed"`
     - `verifiedAt: timestamp`
   - `listings` document updated:
     - `isFeatured: true`
     - `featureExpiresAt: [7 days from now]`
   - Listing now appears at top of search results

3. **Rejection (if payment not received):**
   - Admin clicks "✗ Reject" button
   - Enters rejection reason
   - `featurePurchases` updated with rejection info
   - Listing remains unfeatured

## Next Steps for Enhancement

### Recommended Additions:

1. **Automated Expiration Check:**
   - Create a Cloud Function that runs daily
   - Checks `featureExpiresAt` on all listings
   - Sets `isFeatured: false` when expired
   - Optionally sends notification to user

2. **User Notification:**
   - Email user when payment is approved
   - Email user when featured status is about to expire
   - Email user when payment is rejected

3. **Payment Tracking Page:**
   - Add page where users can view their feature purchase history
   - Show pending/completed/rejected purchases
   - Allow users to view payment status

4. **Automated Payment Integration (Future):**
   - Integrate Stripe/PayPal API for automatic payments
   - Instant approval when payment confirmed
   - Automatic refunds if rejected

5. **Featured Listings Display:**
   - Update browse page to show featured listings at top
   - Add visual indicator (badge/highlight) for featured listings
   - Sort by featured status, then date

## Testing Checklist

- [ ] Create listing with feature checked - verify purchase record created
- [ ] Verify payment instructions display correctly
- [ ] Admin can see pending purchase in admin panel
- [ ] Admin approve button updates both collections correctly
- [ ] Admin reject button updates purchase status
- [ ] Approved listing shows as featured (check isFeatured field)
- [ ] Featured listing appears at top of search results (if implemented)

## Payment Account Information

Update the payment details in `create-listing.html` with your actual accounts:
```html
<li><strong>Venmo:</strong> @YourVenmoHandle</li>
<li><strong>PayPal:</strong> your-paypal@email.com</li>
<li><strong>Zelle:</strong> your-zelle@email.com</li>
```

## Security Considerations

1. **Firestore Rules:** Ensure rules prevent users from:
   - Modifying their own purchase status
   - Setting isFeatured directly on listings
   - Only admins can update purchase status and featured flags

2. **Admin Access:** Verify admin role checking is properly implemented

## Files Modified

1. `public/create-listing.html` - Added payment UI and instructions
2. `public/admin.html` - Added Feature Purchases tab
3. `public/admin.js` - Added feature purchase loading and approval/rejection logic

## Support & Troubleshooting

If users report payment issues:
1. Check `featurePurchases` collection for their purchase record
2. Verify payment received in Venmo/PayPal/Zelle
3. Manually approve in admin panel
4. If needed, manually update listing: `isFeatured: true, featureExpiresAt: [date]`
