// components/ThemeProvider.tsx
'use client';

import { useEffect, useState, ReactNode } from 'react';
import { ThemeContext, Theme } from './theme-context';
import { Header } from './Header';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check for saved preference or system preference
        const savedTheme = localStorage.getItem('ai-workstation-theme') as Theme;
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme || systemPreference;
        
        setThemeState(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('ai-workstation-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    // Prevent flash of wrong theme - show placeholder header
    if (!mounted) {
        return (
            <>
                <div style={{ 
                    height: '64px', 
                    background: 'var(--surface-primary)', 
                    borderBottom: '1px solid var(--border-primary)' 
                }} />
                <div style={{ visibility: 'hidden' }}>
                    {children}
                </div>
            </>
        );
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            <Header />
            {children}
        </ThemeContext.Provider>
    );
}

// Re-export useTheme for convenience
export { useTheme } from './theme-context';
