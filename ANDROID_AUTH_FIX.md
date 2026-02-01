# Fix: Firebase Auth "Missing Initial State" Error in Android

## Problem
When using Firebase Authentication with Google Sign-In in a Capacitor Android app, you may encounter:
```
Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible or accidentally cleared.
```

## Root Cause
This error occurs because:
1. Capacitor's Android webview has storage partitioning restrictions
2. OAuth redirect flows don't work seamlessly in native webviews
3. Firebase Auth needs proper persistence configuration for native platforms

## Solutions Applied

### ✅ 1. Updated Capacitor Configuration
**File: `capacitor.config.json`**
- Added server hostname matching your Firebase authDomain
- Set androidScheme to `https`
- Enabled cleartext for local development

### ✅ 2. Updated Firebase Configuration
**File: `src/services/firebase.js`**
- Added platform detection using `Capacitor.isNativePlatform()`
- Configured `indexedDBLocalPersistence` for native platforms
- Disabled Analytics on native platforms (prevents errors)
- Added custom parameters to Google Provider for better UX

### ✅ 3. Installed Required Dependencies
- Installed `@capacitor/core` package

### ✅ 4. Rebuilt and Synced
- Built the app with `npm run build`
- Synced with Capacitor using `npx cap sync android`

## Next Steps

### Test the App
1. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

2. **Run on Device/Emulator:**
   - Click the "Run" button in Android Studio
   - Test the Google Sign-In functionality

### If Still Having Issues

#### Alternative Solution A: Add SHA-1 Fingerprint
You need to add your app's SHA-1 fingerprint to Firebase Console:

1. **Get Debug SHA-1:**
   ```bash
   cd android
   ./gradlew signingReport
   ```
   Or on Windows:
   ```powershell
   cd android
   .\gradlew.bat signingReport
   ```

2. **Add to Firebase Console:**
   - Go to Firebase Console → Project Settings
   - Under "Your apps" → Android app
   - Add the SHA-1 certificate fingerprint
   - Download the new `google-services.json`
   - Replace `android/app/google-services.json`

#### Alternative Solution B: Use Browser Tab (Recommended for Production)

Instead of popup, use the Capacitor Browser plugin for a more native experience:

**Install:**
```bash
npm install @capacitor/browser
npx cap sync
```

**Update AuthContext.jsx:**
```javascript
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';

function loginWithGoogle() {
    if (Capacitor.isNativePlatform()) {
        // Use redirect on mobile
        return signInWithRedirect(auth, googleProvider);
    } else {
        // Use popup on web
        return signInWithPopup(auth, googleProvider);
    }
}

// In useEffect, check for redirect result on mobile
useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        getRedirectResult(auth).then((result) => {
            if (result) {
                setCurrentUser(result.user);
            }
        }).catch((error) => {
            console.error('Redirect error:', error);
        });
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
    });

    return unsubscribe;
}, []);
```

#### Alternative Solution C: Use Native Google Sign-In Plugin

For the most reliable solution, use Capacitor's native Google Auth:

**Install:**
```bash
npm install @codetrix-studio/capacitor-google-auth
npx cap sync
```

**Configure in capacitor.config.json:**
```json
{
  "plugins": {
    "GoogleAuth": {
      "scopes": ["profile", "email"],
      "serverClientId": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
      "forceCodeForRefreshToken": true
    }
  }
}
```

**Update AuthContext.jsx:**
```javascript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

// Initialize on native platforms
if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize();
}

async function loginWithGoogle() {
    if (Capacitor.isNativePlatform()) {
        try {
            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            return signInWithCredential(auth, credential);
        } catch (error) {
            console.error('Native Google Sign-In error:', error);
            throw error;
        }
    } else {
        return signInWithPopup(auth, googleProvider);
    }
}
```

## Debugging Tips

1. **Enable Developer Mode:**
   - Settings → About Phone → Tap "Build Number" 7 times
   - Enable USB debugging in Developer Options

2. **Check Chrome DevTools:**
   - Open `chrome://inspect` in Chrome
   - Inspect your app's webview
   - Check Console for errors

3. **Check Logcat:**
   ```bash
   adb logcat | grep -i "firebase\|auth\|google"
   ```

4. **Verify Firebase Configuration:**
   - Ensure `google-services.json` is in `android/app/`
   - Verify package name matches in Firebase Console

## Common Issues

### Issue: "API key not valid"
**Solution:** Download fresh `google-services.json` from Firebase Console

### Issue: "Developer Error"
**Solution:** Add SHA-1 fingerprint to Firebase Console

### Issue: "Network Error"
**Solution:** Check internet connection and Firebase project status

### Issue: Popup blocked
**Solution:** Already handled by our configuration changes

## Testing Checklist

- [ ] App builds without errors
- [ ] Google Sign-In button appears
- [ ] Clicking button opens authentication flow
- [ ] Successfully authenticates and redirects
- [ ] User data persists after app restart
- [ ] Works on both emulator and physical device

## Resources

- [Firebase Auth for Capacitor](https://firebase.google.com/docs/auth/web/cordova)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
- [Capacitor Google Auth Plugin](https://github.com/CodetrixStudio/CapacitorGoogleAuth)

---

**Applied Changes:**
- ✅ capacitor.config.json - Added server configuration
- ✅ src/services/firebase.js - Platform-specific auth initialization
- ✅ Rebuilt and synced with Capacitor

**Status:** Ready to test on Android device/emulator
