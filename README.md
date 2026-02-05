# Attendance Tracker

A modern, responsive web and mobile application for tracking class attendance, managing timetables, and viewing attendance statistics. Built with React, Vite, Firebase, and Capacitor.

## 🚀 Getting Started (Developer Guide)

Follow these instructions to set up the project locally on your machine.

### Prerequisites

*   **Node.js**: Ensure you have Node.js installed (v16+ recommended).
*   **Android Studio**: Required if you plan to build or run the Android native app.

### Installation

1.  **Clone the repository** (if you haven't already).
2.  **Install dependencies**:
    ```bash
    npm install
    ```

### Running the Web App

To start the local development server:

```bash
npm run dev
```

The app will typically run at `http://localhost:5173`.

### Building for Production

To create a production build (output to `dist/`):

```bash
npm run build
```

### 📱 Android Development

This project uses **Capacitor** to run as a native Android app.

1.  **Sync Web Assets**:
    After building the web app (`npm run build`), sync the changes to the Android native project:
    ```bash
    npx cap sync
    ```

2.  **Open in Android Studio**:
    ```bash
    npx cap open android
    ```
    From Android Studio, you can run the app on an emulator or a physical device.

## 🛠️ Configuration

### Firebase
The app relies on Firebase for Authentication and Firestore.
*   Ensure `src/services/firebase.js` contains your valid Firebase configuration.
*   Ensure `google-services.json` is present in `android/app/` for native Android Google Sign-In.

### KeyStore (Android Release)
To generate a release APK, you will need a signing key.
*   Use `generate_keystore.ps1` (PowerShell) or `make_keystore.bat` (Batch) to generate a keystore if needed.
*   Refer to `KEYSTORE_DETAILS.md` for information on the keystore alias and passwords.

## 📚 User Guide

For instructions on how to use the application features, please refer to [instructions.txt](./instructions.txt).
