'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Language, translations, TranslationKeys, LANGUAGE_NAMES } from './i18n'
import { de, enUS, Locale } from 'date-fns/locale'

const STORAGE_KEY = 'tinyplanvas-language'

// Get browser language or default to English
function getBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const browserLang = navigator.language.split('-')[0]
  return browserLang === 'de' ? 'de' : 'en'
}

// Load saved language from localStorage
function loadSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'de' || saved === 'en') {
      return saved
    }
  } catch (e) {
    console.error('Failed to load language preference:', e)
  }
  return getBrowserLanguage()
}

// Save language to localStorage
function saveLanguage(lang: Language) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (e) {
    console.error('Failed to save language preference:', e)
  }
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (category: keyof TranslationKeys, key: string) => string
  dateLocale: Locale
  formatDate: (date: Date | string, formatStr?: string) => string
  availableLanguages: typeof LANGUAGE_NAMES
}

const LanguageContext = createContext<LanguageContextType | null>(null)

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('en')
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize language on mount (client-side only)
  useEffect(() => {
    const savedLang = loadSavedLanguage()
    setLanguageState(savedLang)
    setIsInitialized(true)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    saveLanguage(lang)
  }, [])

  // Translation function
  const t = useCallback((category: keyof TranslationKeys, key: string): string => {
    const categoryTranslations = translations[category] as Record<string, Record<Language, string>>
    const translation = categoryTranslations?.[key]
    if (!translation) {
      console.warn(`Missing translation: ${category}.${key}`)
      return key
    }
    return translation[language] || translation.en || key
  }, [language])

  // Date locale
  const dateLocale = language === 'de' ? de : enUS

  // Date formatting helper
  const formatDate = useCallback((date: Date | string, formatStr?: string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (!formatStr) {
      return dateObj.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')
    }
    // Use date-fns format if needed (import format in component)
    return dateObj.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')
  }, [language])

  // Prevent hydration mismatch by not rendering until initialized
  if (!isInitialized) {
    return null
  }

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      t,
      dateLocale,
      formatDate,
      availableLanguages: LANGUAGE_NAMES,
    }}>
      {children}
    </LanguageContext.Provider>
  )
}

// Hook to use language context
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Hook for translations only (shorthand)
export function useTranslation() {
  const { t, language, dateLocale } = useLanguage()
  return { t, language, dateLocale }
}
