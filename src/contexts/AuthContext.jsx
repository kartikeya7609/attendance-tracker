
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
                // Use Capacitor Firebase Authentication for native platforms
                console.log('Using Capacitor Firebase Auth...');
                const result = await FirebaseAuthentication.signInWithGoogle();

                // CRITICAL: Sign in to the JS SDK using the native ID token
                // Otherwise the app state won't update
                if (result.credential && result.credential.idToken) {
                    const credential = GoogleAuthProvider.credential(result.credential.idToken);
                    return await signInWithCredential(auth, credential);
                }

                return result;
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
