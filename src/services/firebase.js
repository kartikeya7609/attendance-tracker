
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
const analytics = getAnalytics(app);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
