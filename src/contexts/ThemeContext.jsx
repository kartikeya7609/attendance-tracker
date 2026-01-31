
import React, { useContext, useState, useEffect, createContext } from "react";

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        // Check local storage or preference
        const saved = localStorage.getItem("app-theme");
        if (saved) return saved;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });

    const toggleTheme = () => {
        setTheme(prev => prev === "light" ? "dark" : "light");
    };

    useEffect(() => {
        // Apply theme to html or body
        document.documentElement.setAttribute("data-theme", theme);
        // Also support bootstrap's mode if using 5.3+
        document.documentElement.setAttribute("data-bs-theme", theme);
        localStorage.setItem("app-theme", theme);
    }, [theme]);

    // Listen for system changes if no preference is saved (optional, keeping simple for now)

    const value = {
        theme,
        toggleTheme
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
