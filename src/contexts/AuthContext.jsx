
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
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';

const AuthContext = React.createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function loginWithGoogle() {
        try {
            if (Capacitor.isNativePlatform()) {
                // 1. Native Google Sign-In
                // Using the specific client ID as requested
                const result = await FirebaseAuthentication.signInWithGoogle({
                    clientId: '847360454343-teg07ichndbnotlvobun43hgoajp1mb7.apps.googleusercontent.com',
                    scopes: ['profile', 'email']
                });

                // 2. Convert to Firebase credential
                const credential = GoogleAuthProvider.credential(
                    result.credential?.idToken
                );

                // 3. Firebase login (signInWithCredential is used, NOT signInWithPopup)
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
        // Sign out from native Firebase Authentication on native platforms
        if (Capacitor.isNativePlatform()) {
            FirebaseAuthentication.signOut().catch(err => console.error('Native signout error:', err));
        }
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
