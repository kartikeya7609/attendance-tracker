
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getAuth,
    GoogleAuthProvider,
    indexedDBLocalPersistence,
    browserLocalPersistence,
    initializeAuth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMn0KalOoYrBBykxkOiK28R2eEGecOFPQ",
    authDomain: "attendance-tracker-1627.firebaseapp.com",
    projectId: "attendance-tracker-1627",
    storageBucket: "attendance-tracker-1627.firebasestorage.app",
    messagingSenderId: "983204092267",
    appId: "1:983204092267:web:aaaabab6f2062687c0142e",
    measurementId: "G-E7SNXVS6RY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only on web)
let analytics;
if (!Capacitor.isNativePlatform()) {
    analytics = getAnalytics(app);
}

// Initialize Auth with proper persistence for Capacitor
let auth;
if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
} else {
    auth = getAuth(app);
}

// Initialize Services
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Configure Google Provider for better mobile experience
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

export { auth, db, googleProvider };
export default app;
