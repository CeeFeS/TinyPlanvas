'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { Priority } from '@/lib/types'
import { PRIORITY_ORDER, getPriorityMeta } from '@/lib/priority'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'

interface PrioritySelectProps {
  value?: Priority | null
  onChange: (priority: Priority) => void
  disabled?: boolean
}

export function PrioritySelect({ value, onChange, disabled }: PrioritySelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = getPriorityMeta(value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
          disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-95'
        )}
        style={{
          backgroundColor: `${meta.color}1A`,
          color: meta.color,
          borderColor: `${meta.color}66`,
        }}
        title={t('priorities', 'priority')}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
        {t('priorities', meta.labelKey)}
        {!disabled && <ChevronDown size={12} />}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-surface rounded-lg shadow-lg border border-paper-lines z-50 py-1">
          {PRIORITY_ORDER.map((value_) => {
            const m = getPriorityMeta(value_)
            const active = value === value_
            return (
              <button
                key={value_}
                type="button"
                onClick={() => {
                  onChange(value_)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-paper-warm transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                <span className="flex-1 text-left">{t('priorities', m.labelKey)}</span>
                {active && <Check size={14} className="text-ink-blue" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
