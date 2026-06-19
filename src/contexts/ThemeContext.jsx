
import React, { useContext, useState, useEffect, createContext } from "react";

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {

        const saved = localStorage.getItem("app-theme");
        if (saved) return saved;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });

    const toggleTheme = () => {
        setTheme(prev => prev === "light" ? "dark" : "light");
    };

    useEffect(() => {

        document.documentElement.setAttribute("data-theme", theme);

        document.documentElement.setAttribute("data-bs-theme", theme);
        localStorage.setItem("app-theme", theme);
    }, [theme]);

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
