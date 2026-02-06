'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  cookieConsent: boolean;
  setCookieConsent: (consent: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Cookie utilities
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [cookieConsent, setCookieConsentState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize from cookies on mount
  useEffect(() => {
    setMounted(true);

    // Check cookie consent
    const consent = getCookie('ecod_cookie_consent');
    if (consent === 'true') {
      setCookieConsentState(true);

      // Load theme preference if consent given
      const savedTheme = getCookie('ecod_theme') as Theme | null;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme);
      }
    }
  }, []);

  // Resolve theme based on system preference
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();
    mediaQuery.addEventListener('change', updateResolvedTheme);

    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [theme, mounted]);

  // Apply theme class to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);

    // Only save to cookie if consent given
    if (cookieConsent) {
      setCookie('ecod_theme', newTheme);
    }
  };

  const setCookieConsent = (consent: boolean) => {
    setCookieConsentState(consent);
    setCookie('ecod_cookie_consent', consent ? 'true' : 'false');

    if (consent) {
      // Save current theme preference
      setCookie('ecod_theme', theme);
    } else {
      // Delete preference cookie
      deleteCookie('ecod_theme');
    }
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: 'system',
          resolvedTheme: 'light',
          setTheme: () => {},
          cookieConsent: false,
          setCookieConsent: () => {},
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        cookieConsent,
        setCookieConsent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
