# Google Sign-In Setup Guide

If Google sign-in isn't working, you need to enable it in the Firebase Console.

## Steps to Enable Google Sign-In

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/project/local-list-wski21/authentication/providers

2. **Enable Google Provider**
   - Click on "Google" in the Sign-in providers list
   - Toggle the "Enable" switch to ON
   - Set a Project public-facing name (e.g., "Local List")
   - Add a Support email (your email address)
   - Click "Save"

3. **Add Authorized Domains** (if testing locally)
   - Go to Settings > Authorized domains
   - Make sure `localhost` is in the list for local testing
   - Add your production domain when you deploy

4. **Test the Sign-In**
   - Open your app in the browser
   - Click "Sign up with Google" or "Sign in with Google"
   - You should see the Google sign-in popup

## Common Issues

### "This app is blocked"
- This happens if you haven't set up OAuth consent screen
- Go to: https://console.cloud.google.com/apis/credentials/consent
- Set up the OAuth consent screen
- Add test users if needed

### "Popup blocked"
- Make sure popups are allowed for your site
- Check browser console for errors

### "auth/unauthorized-domain"
- Add your domain to Authorized domains in Firebase Console
- Settings > Authorized domains > Add domain

## What's Already Implemented

✅ Email verification on signup
✅ Google sign-in button on login page
✅ Google sign-in button on signup page
✅ User profile creation for both email and Google sign-in
✅ Error handling and logging

## Current Status

- **Email/Password Sign-in**: ✅ Working
- **Google Sign-in**: ⚠️ Needs to be enabled in Firebase Console
- **Email Verification**: ✅ Implemented (emails sent on signup)
- **Security Rules**: ✅ Updated (users can create listings without email verification)
