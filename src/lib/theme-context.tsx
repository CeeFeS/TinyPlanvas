'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
/** The actually applied theme (resolved from "system") */
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'tinyplanvas-theme'

/**
 * Inline script (injected in <head>) that applies the persisted theme BEFORE
 * React hydrates, preventing a flash of the wrong theme. Keep in sync with the
 * logic below. Default is "light".
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'light';
    var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    if (isDark) { el.classList.add('dark'); } else { el.classList.remove('dark'); }
    el.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();
`

function loadSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  } catch {
    /* ignore */
  }
  return 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  }
  return theme
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (resolved === 'dark') {
    el.classList.add('dark')
  } else {
    el.classList.remove('dark')
  }
  el.style.colorScheme = resolved
}

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // Initialize on mount (client only)
  useEffect(() => {
    const saved = loadSavedTheme()
    setThemeState(saved)
    const resolved = resolveTheme(saved)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  // React to OS changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const resolved: ResolvedTheme = mq.matches ? 'dark' : 'light'
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    const resolved = resolveTheme(next)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>

}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
