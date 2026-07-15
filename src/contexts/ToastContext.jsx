import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
    return useContext(ToastContext);
}

let _id = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, variant = 'success', duration = 3500) => {
        const id = ++_id;
        setToasts(prev => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const icons = {
        success: '✅',
        danger:  '❌',
        warning: '⚠️',
        info:    'ℹ️',
    };

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="toast-stack" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={`app-toast app-toast-${t.variant} animate-slide-up`}>
                        <span className="app-toast-icon">{icons[t.variant] ?? 'ℹ️'}</span>
                        <span className="app-toast-msg">{t.message}</span>
                        <button className="app-toast-close" onClick={() => removeToast(t.id)}>×</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
