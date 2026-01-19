'use client'

import { Check, Globe } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguagePanel() {
  const { language, setLanguage, t, availableLanguages } = useLanguage()

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: availableLanguages.en, flag: '🇬🇧' },
    { code: 'de', name: availableLanguages.de, flag: '🇩🇪' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-hand text-xl text-ink mb-2">{t('settings', 'language')}</h3>
        <p className="text-sm text-ink-light">
          {t('settings', 'languageDesc')}
        </p>
      </div>

      <div className="space-y-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
              language === lang.code
                ? 'border-ink-blue bg-ink-blue/5'
                : 'border-paper-lines hover:border-ink-faded/50 hover:bg-paper-warm/50'
            )}
          >
            <span className="text-2xl">{lang.flag}</span>
            <div className="flex-1">
              <span className={cn(
                'font-medium block',
                language === lang.code ? 'text-ink-blue' : 'text-ink'
              )}>
                {lang.name}
              </span>
              <span className="text-xs text-ink-faded">
                {lang.code.toUpperCase()}
              </span>
            </div>
            {language === lang.code && (
              <Check size={20} className="text-ink-blue" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-paper-lines">
        <div className="flex items-center gap-2 text-xs text-ink-faded">
          <Globe size={14} />
          <span>
            {language === 'de' 
              ? 'Die Spracheinstellung wird lokal gespeichert.'
              : 'Language preference is saved locally.'
            }
          </span>
        </div>
      </div>
    </div>
  )
}
