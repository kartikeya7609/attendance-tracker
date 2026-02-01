# Complete Fix for Android Google Sign-In

## Current Issue
The error "Firebase: Error (auth/argument-error)" occurs because your Firebase project is missing proper Android OAuth configuration.

## Critical Missing Configuration

### ❌ Current Problem
Your `google-services.json` only has a **web client** (client_type: 3) but is missing an **Android OAuth client**.

### ✅ Required Configuration

You need to:
1. Add your Android app's SHA-1 fingerprint to Firebase
2. Download the updated `google-services.json` with the Android OAuth client

## Step-by-Step Fix

### Step 1: Get Your SHA-1 Fingerprint

Run this command to get your debug SHA-1:

```powershell
cd android
.\gradlew.bat signingReport
```

Look for output like this:
```
Variant: debug
Config: debug
Store: C:\Users\YourName\.android\debug.keystore
Alias: AndroidDebugKey
MD5: XX:XX:XX:...
SHA1: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
SHA-256: ...
```

**Copy the SHA1 value!**

### Step 2: Add SHA-1 to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **attendance-tracker-1627**
3. Go to **Project Settings** (gear icon)
4. Scroll down to **Your apps**
5. Find your Android app: **com.attendance.app**
6. Click **Add fingerprint**
7. Paste your SHA-1 and click **Save**

### Step 3: Download New google-services.json

1. Still in Firebase Console → Project Settings
2. Scroll to your Android app
3. Click **Download google-services.json**
4. Replace `android/app/google-services.json` with the new file

The new file should have an OAuth client with `client_type: 1` (Android)

### Step 4: Rebuild and Sync

```bash
npm run build
npx cap sync android
```

### Step 5: Test on Android

```bash
npx cap open android
```

Then run the app and test Google Sign-In.

## Alternative: Use Native Google Sign-In Plugin (Recommended)

If the above still doesn't work, use the Capacitor Google Auth plugin for native authentication:

### Install Plugin

```bash
npm install @codetrix-studio/capacitor-google-auth
npx cap sync
```

### Update capacitor.config.json

```json
{
  "appId": "com.attendance.app",
  "appName": "attendance.app",
  "webDir": "dist",
  "server": {
    "hostname": "attendance-tracker-1627.firebaseapp.com",
    "androidScheme": "https",
    "cleartext": true
  },
  "plugins": {
    "GoogleAuth": {
      "scopes": ["profile", "email"],
      "serverClientId": "983204092267-3tnr2dcqqtrf5q8csm5fq5hln0ubmhl1.apps.googleusercontent.com",
      "forceCodeForRefreshToken": true
    }
  }
}
```

### Update AuthContext.jsx

Add this at the top:
```javascript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
```

Initialize (add to AuthProvider before useEffect):
```javascript
// Initialize GoogleAuth for native platforms
useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        GoogleAuth.initialize({
            clientId: '983204092267-3tnr2dcqqtrf5q8csm5fq5hln0ubmhl1.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
        });
    }
}, []);
```

Update loginWithGoogle function:
```javascript
async function loginWithGoogle() {
    try {
        if (Capacitor.isNativePlatform()) {
            // Native Google Sign-In for mobile
            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            return signInWithCredential(auth, credential);
        } else {
            // Popup for web
            return signInWithPopup(auth, googleProvider);
        }
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        throw error;
    }
}
```

### Rebuild
```bash
npm run build
npx cap sync android
npx cap open android
```

## Troubleshooting

### Error: "12500: Sign-in process was cancelled"
**Solution:** User cancelled the sign-in. This is expected behavior.

### Error: "10: Developer Error"
**Solution:** SHA-1 fingerprint not added or wrong client ID. Check Firebase Console.

### Error: "auth/network-request-failed"
**Solution:** Check internet connection. Ensure Firebase project is active.

### Error: "auth/internal-error"
**Solution:** google-services.json is corrupted or missing. Re-download from Firebase Console.

## Verification Checklist

Before testing:
- [ ] SHA-1 added to Firebase Console
- [ ] New google-services.json downloaded
- [ ] File is in `android/app/google-services.json`
- [ ] New file has Android OAuth client (client_type: 1)
- [ ] App rebuilt with `npm run build`
- [ ] Capacitor synced with `npx cap sync android`
- [ ] OAuth 2.0 Web client ID used in plugin config

## Expected google-services.json Structure

After adding SHA-1, your file should look like:
```json
{
  "oauth_client": [
    {
      "client_id": "XXX-ANDROID.apps.googleusercontent.com",
      "client_type": 1  // ← THIS IS THE ANDROID CLIENT
    },
    {
      "client_id": "XXX.apps.googleusercontent.com",
      "client_type": 3  // ← This is the web client
    }
  ]
}
```

## Quick Command Reference

```bash
# Get SHA-1
cd android
.\gradlew.bat signingReport

# Install native plugin
npm install @codetrix-studio/capacitor-google-auth

# Build and sync
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android

# Check logs
adb logcat | Select-String "GoogleAuth|Firebase|Auth"
```

---

**Status:** 
- ✅ Fixed persistence array issue
- ✅ Moved google-services.json to correct location
- ⏳ **NEXT:** Add SHA-1 fingerprint to Firebase Console and download new google-services.json
