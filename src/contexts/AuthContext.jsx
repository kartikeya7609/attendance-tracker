
import React, { useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../services/firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithCredential
} from "firebase/auth";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

const AuthContext = React.createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

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

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function loginWithGoogle() {
        try {
            if (Capacitor.isNativePlatform()) {
                // Use native Google Sign-In for mobile
                console.log('Using native Google Auth...');
                const googleUser = await GoogleAuth.signIn();
                console.log('Google user:', googleUser);

                // Create Firebase credential from Google ID token
                const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
                return await signInWithCredential(auth, credential);
            } else {
                // Use popup for web
                console.log('Using web popup...');
                return await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        signup,
        login,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
