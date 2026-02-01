# Android Keystore Credentials

Keep this file safe! You will need these details to update your app in the Play Store in the future.

## Credentials
- **File Path:** `android/app/my-release-key.keystore`
- **Key Alias:** `my-key-alias`
- **Store Password:** `password`
- **Key Password:** `password`

## SHA-1 Fingerprint (Release)
`47:50:A4:D1:6B:8A:3F:E3:1C:2F:D3:B1:2E:C0:D0:B0:AE:AC:3E:B3`

## Usage
These credentials are currently configured in `android/app/build.gradle`.

### ⚠️ Important Action
Ensure you have added the **SHA-1 Fingerprint** above to your Firebase Console under Project Settings -> Your Apps (Android). If you don't, Google Sign-In will fail on release builds.
