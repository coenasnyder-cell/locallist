# Environment Setup: Development vs Production Firebase

## Overview

This application uses separate Firebase projects for **development** and **production** builds to prevent test analytics and data from polluting your production Firestore, Authentication, and Storage.

**Current Setup:**
- **Production Project:** `local-list-wski21` (live data)
- **Development Project:** Needs to be created (for testing builds)

---

## Why Separate Environments?

1. **Data Isolation:** Test events, users, and listings won't mix with production
2. **Analytics Accuracy:** Dashboard won't show inflated metrics from development
3. **Cost Control:** Dev & prod usage tracked separately
4. **Safety:** Accidental deletes/updates during testing don't affect live data

---

## Step 1: Create Development Firebase Project

### 1a. Create New Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"**
3. Name it: `myApp-dev` (or similar)
4. Uncheck Google Analytics (optional for dev)
5. Click **Create Project**

### 1b. Set Up Services
Once your dev project is created:

**Enable Firestore:**
- Go to **Firestore Database** in left sidebar
- Click **Create Database**
- Start in **test mode** (read/write for 30 days)
- Choose a default location
- Click **Create**

**Enable Authentication:**
- Go to **Authentication** in left sidebar
- Click **Get Started**
- Enable **Email/Password**
- Enable **Google** provider (same OAuth credentials as prod)

**Enable Storage:**
- Go to **Storage** in left sidebar
- Click **Get started**
- Start in **Test mode**
- Choose the same location as Firestore
- Click **Done**

### 1c. Get Firebase Credentials

1. Go to **Project Settings** (⚙️ icon at top)
2. Under **Your apps**, click the **Web app** (or create one if missing)
3. Copy the full `firebaseConfig` object
4. Your credentials look like:
```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "myapp-dev.firebaseapp.com",
  "projectId": "myapp-dev",
  "storageBucket": "myapp-dev.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123def456",
  "measurementId": "G-ABC123"
}
```

---

## Step 2: Add Credentials to Local .env File

Only for local development (NOT committed to git):

1. Create `.env` file in project root (if it doesn't exist):
```bash
touch .env
```

2. Copy from `.env.example` and fill in dev credentials:
```bash
EXPO_PUBLIC_DEV_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN=myapp-dev.firebaseapp.com
EXPO_PUBLIC_DEV_FIREBASE_PROJECT_ID=myapp-dev
EXPO_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET=myapp-dev.firebasestorage.app
EXPO_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_DEV_FIREBASE_APP_ID=1:123456789:web:abc123def456
EXPO_PUBLIC_DEV_FIREBASE_MEASUREMENT_ID=G-ABC123
```

3. **NEVER commit .env to git** (.gitignore should already exclude it)

---

## Step 3: Set Up EAS Secrets (For CI/CD)

When building via EAS CLI (not local), use EAS Secrets to securely store credentials:

```bash
# Create a secret for dev API key
eas secret:create --scope project --name DEV_FIREBASE_API_KEY

# When prompted, paste: AIzaSy... (from dev project)

# Repeat for all other dev credentials:
eas secret:create --scope project --name DEV_FIREBASE_AUTH_DOMAIN
eas secret:create --scope project --name DEV_FIREBASE_PROJECT_ID
# ... etc
```

Then update `eas.json` to reference secrets:
```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_DEV_FIREBASE_API_KEY": "@/DEV_FIREBASE_API_KEY"
      }
    }
  }
}
```

---

## Step 4: Build with Environment

### Local Build (Development)
Reads from `.env` file:
```bash
npm run eas:build:dev:android
# Uses EXPO_PUBLIC_APP_ENV=development
# Connects to myapp-dev Firebase project
```

### Local Build (Preview)
Uses production credentials (for staging):
```bash
npm run eas:build:preview:android
# Uses EXPO_PUBLIC_APP_ENV=preview
# Connects to local-list-wski21 Firebase project
```

### Production Build
Uses production credentials:
```bash
npm run eas:build:prod:ios
# Uses EXPO_PUBLIC_APP_ENV=production
# Connects to local-list-wski21 Firebase project
```

---

## Step 5: Verify Environment Isolation

After building and installing the dev app:

1. Open the app and sign in
2. Create a test listing
3. Check Firebase Console:
   - **Dev App:** Data appears in `myapp-dev` project only
   - **Prod App:** Data appears in `local-list-wski21` project only

---

## Firestore Rules for Both Environments

Copy your production Firestore rules to the development project:

1. Go to **Firestore Database** → **Rules** tab
2. Copy all rules from production `firestore.rules`
3. Paste into dev project **Rules** tab
4. Click **Publish**

---

## Environment Variable Reference

| Variable | Dev | Preview | Prod |
|----------|-----|---------|------|
| `EXPO_PUBLIC_APP_ENV` | `"development"` | `"preview"` | `"production"` |
| Firebase Project | `myapp-dev` | `local-list-wski21` | `local-list-wski21` |
| Data Isolation | ✅ Yes | Mixed 🟡 | ✅ Yes |

**Preview Note:** Preview builds share production Firebase. Use preview to test features before release, but be aware staging data goes to production Firestore.

---

## Troubleshooting

### "Firebase project not found during build"
- Check .env file has correct PROJECT_ID
- Verify EAS secrets are set correctly: `eas secret:list`
- Run: `eas build --platform android --profile development --wait`

### "Analytics events not appearing"
- Verify `appAnalyticsEvents` Firestore rules exist in dev project
- Copy `firestore.rules` from production → dev & publish
- Check app is using correct Firebase project: `console.log()` in firebase.ts

### "Auth sign-in not working"
- Verify OAuth credentials in dev Firebase project match production (same Google OAuth app)
- Enable Email/Password auth in dev Firebase

---

## Next Steps

1. ✅ Create dev Firebase project (Steps 1-2)
2. ✅ Set up .env with dev credentials (Step 3)
3. ✅ Build dev app: `npm run eas:build:dev:android`
4. ✅ Test sign-in and data isolation
5. ✅ Copy production Firestore rules to dev project
6. ✅ Verify analytics events appear only in correct project

---

**Questions?** Check `.env.example` or firebase.ts for config structure.
