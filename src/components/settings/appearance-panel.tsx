'use client'

import { Check, Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme-context'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'

export function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const options: { value: Theme; name: string; desc: string; icon: typeof Sun }[] = [
    { value: 'light', name: t('settings', 'themeLight'), desc: t('settings', 'themeLightDesc'), icon: Sun },
    { value: 'dark', name: t('settings', 'themeDark'), desc: t('settings', 'themeDarkDesc'), icon: Moon },
    { value: 'system', name: t('settings', 'themeSystem'), desc: t('settings', 'themeSystemDesc'), icon: Monitor },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-hand text-xl text-ink mb-2">{t('settings', 'appearance')}</h3>
        <p className="text-sm text-ink-light">{t('settings', 'appearanceDesc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon
          const active = theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left',
                active
                  ? 'border-ink-blue bg-ink-blue/5'
                  : 'border-paper-lines hover:border-ink-faded/50 hover:bg-paper-warm/50'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <Icon size={20} className={active ? 'text-ink-blue' : 'text-ink-light'} />
                {active && <Check size={18} className="text-ink-blue" />}
              </div>
              <span className={cn('font-medium block', active ? 'text-ink-blue' : 'text-ink')}>
                {opt.name}
              </span>
              <span className="text-xs text-ink-faded">{opt.desc}</span>
            </button>
          )
        })}
      </div>

      <div className="pt-4 border-t border-paper-lines">
        <div className="flex items-center gap-2 text-xs text-ink-faded">
          <Palette size={14} />
          <span>{t('settings', 'themeSavedLocally')}</span>
        </div>
      </div>
    </div>
  )
}
