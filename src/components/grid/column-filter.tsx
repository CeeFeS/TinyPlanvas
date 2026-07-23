'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ListFilter, Check } from 'lucide-react'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'

interface ColumnFilterProps {
  /** Human readable column title (used for the tooltip/heading). */
  title: string
  /** Distinct values available for this column. */
  values: string[]
  /** Currently selected values (empty set = no filter, show all). */
  selected: Set<string>
  onChange: (next: Set<string>) => void
  /** Horizontal anchor of the dropdown relative to the trigger. */
  align?: 'left' | 'right'
}

const MENU_WIDTH = 240

/**
 * Compact, subtle per-column filter: a small funnel button that opens a
 * checkbox dropdown. The dropdown is rendered in a portal (position: fixed) so
 * it is never clipped by the grid's scroll container.
 */
export function ColumnFilter({ title, values, selected, onChange, align = 'left' }: ColumnFilterProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const hasFilter = selected.size > 0

  const computePos = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    let left = align === 'right' ? r.right - MENU_WIDTH : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
    setPos({ top: r.bottom + 4, left })
  }, [align])

  const toggleOpen = () => {
    if (!open) computePos()
    setOpen((v) => !v)
  }

  // Close on outside click, Escape, or any scroll (fixed menu would otherwise detach)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const toggleValue = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  const clear = () => onChange(new Set())

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className={cn(
          'inline-flex items-center justify-center rounded p-0.5 transition-colors flex-shrink-0',
          hasFilter
            ? 'text-ink-blue bg-ink-blue/10'
            : 'text-ink-faded hover:text-ink hover:bg-paper-warm'
        )}
        title={`${title} – ${t('grid', 'filterColumn')}`}
        aria-label={`${title} – ${t('grid', 'filterColumn')}`}
      >
        <ListFilter size={12} />
        {hasFilter && <span className="ml-0.5 text-[9px] font-mono leading-none">{selected.size}</span>}
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-surface rounded-lg shadow-lg border border-paper-lines z-[200] py-1 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-paper-lines">
            <span className="text-[11px] uppercase tracking-wide text-ink-faded truncate">{title}</span>
            {hasFilter && (
              <button onClick={clear} className="text-[11px] text-ink-blue hover:underline flex-shrink-0 ml-2">
                {t('grid', 'clearFilter')}
              </button>
            )}
          </div>

          {values.length === 0 ? (
            <div className="px-3 py-3 text-xs text-ink-faded italic">{t('grid', 'noFilterValues')}</div>
          ) : (
            <ul className="py-0.5 max-h-64 overflow-y-auto">
              {values.map((value) => {
                const active = selected.has(value)
                return (
                  <li key={value}>
                    <button
                      onClick={() => toggleValue(value)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-warm transition-colors text-left"
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                          active ? 'bg-ink-blue border-ink-blue text-white' : 'border-paper-lines'
                        )}
                      >
                        {active && <Check size={11} />}
                      </span>
                      <span className="truncate font-mono text-xs">{value}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
