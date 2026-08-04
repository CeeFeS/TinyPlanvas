'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Paintbrush, ChevronDown, Check, Plus, X, Save } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { DEFAULT_PERCENTAGES, DEFAULT_BASE_COLOR, MAX_PERCENTAGE_PRESETS, COLOR_PALETTE } from '@/lib/types'
import { cn, percentageToOpacity, getContrastTextColor } from '@/lib/utils'
import type { CSSProperties } from 'react'

const STORAGE_KEY_PERCENTAGES = 'tinyplanvas-brush-percentages'
const LEGACY_STORAGE_KEY_PERCENTAGES = 'tinyplanvas-custom-percentages'
const STORAGE_KEY_BASE_COLOR = 'tinyplanvas-base-color'

function normalizePercentages(values: unknown): number[] | null {
  if (!Array.isArray(values)) return null
  const nums = values
    .map(v => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(n => !isNaN(n) && n >= 0 && n <= 100)
  const unique = [...new Set(nums)].sort((a, b) => a - b)
  if (unique.length === 0) return null
  return unique.slice(0, MAX_PERCENTAGE_PRESETS)
}

function loadPercentages(): number[] {
  if (typeof window === 'undefined') return [...DEFAULT_PERCENTAGES]

  try {
    const stored = localStorage.getItem(STORAGE_KEY_PERCENTAGES)
    if (stored) {
      const parsed = normalizePercentages(JSON.parse(stored))
      if (parsed) return parsed
    }
  } catch (e) {
    console.error('Failed to load brush percentages:', e)
  }

  // Migrate legacy custom-only list → full preset list
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_PERCENTAGES)
    if (legacy) {
      const customs = normalizePercentages(JSON.parse(legacy)) ?? []
      const merged = normalizePercentages([...DEFAULT_PERCENTAGES, ...customs])
      if (merged) {
        savePercentages(merged)
        localStorage.removeItem(LEGACY_STORAGE_KEY_PERCENTAGES)
        return merged
      }
    }
  } catch (e) {
    console.error('Failed to migrate brush percentages:', e)
  }

  return [...DEFAULT_PERCENTAGES]
}

function savePercentages(percentages: number[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_PERCENTAGES, JSON.stringify(percentages))
  } catch (e) {
    console.error('Failed to save brush percentages:', e)
  }
}

function loadBaseColor(): string {
  if (typeof window === 'undefined') return DEFAULT_BASE_COLOR
  try {
    const stored = localStorage.getItem(STORAGE_KEY_BASE_COLOR)
    if (stored) return stored
  } catch (e) {
    console.error('Failed to load base color:', e)
  }
  return DEFAULT_BASE_COLOR
}

function saveBaseColor(color: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_BASE_COLOR, color)
  } catch (e) {
    console.error('Failed to save base color:', e)
  }
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Hotkey label for preset index: 1–9, then 0 for the 10th */
function hotkeyForIndex(index: number): string | null {
  if (index < 0 || index >= MAX_PERCENTAGE_PRESETS) return null
  if (index === 9) return '0'
  return String(index + 1)
}

function indexFromHotkey(key: string): number | null {
  if (key >= '1' && key <= '9') return Number(key) - 1
  if (key === '0') return 9
  return null
}

export function BrushEditor() {
  const { activeBrush, setActiveBrush } = useProjectStore()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [percentages, setPercentages] = useState<number[]>([...DEFAULT_PERCENTAGES])
  const [baseColor, setBaseColor] = useState(DEFAULT_BASE_COLOR)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPercentageInput, setNewPercentageInput] = useState('')
  const [isEditingPercentage, setIsEditingPercentage] = useState(false)
  const [percentageInput, setPercentageInput] = useState('')
  const brushBarRef = useRef<HTMLDivElement>(null)
  const percentageInputRef = useRef<HTMLInputElement>(null)
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    setPercentages(loadPercentages())
    const savedColor = loadBaseColor()
    setBaseColor(savedColor)
    setActiveBrush({ ...activeBrush, colorHex: savedColor })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isOrphanValue = !percentages.includes(activeBrush.percentage)

  const updatePercentages = useCallback((next: number[]) => {
    const normalized = normalizePercentages(next) ?? [...DEFAULT_PERCENTAGES]
    setPercentages(normalized)
    savePercentages(normalized)
    return normalized
  }, [])

  const applyPercentage = useCallback((percentage: number) => {
    setActiveBrush({ percentage, colorHex: baseColor })
  }, [baseColor, setActiveBrush])

  const cyclePreset = useCallback((direction: 1 | -1) => {
    if (percentages.length === 0) return
    const currentIndex = percentages.indexOf(activeBrush.percentage)
    let nextIndex: number
    if (currentIndex === -1) {
      if (direction > 0) {
        nextIndex = percentages.findIndex(p => p > activeBrush.percentage)
        if (nextIndex === -1) nextIndex = 0
      } else {
        nextIndex = -1
        for (let i = percentages.length - 1; i >= 0; i--) {
          if (percentages[i] < activeBrush.percentage) {
            nextIndex = i
            break
          }
        }
        if (nextIndex === -1) nextIndex = percentages.length - 1
      }
    } else {
      nextIndex = (currentIndex + direction + percentages.length) % percentages.length
    }
    applyPercentage(percentages[nextIndex])
  }, [percentages, activeBrush.percentage, applyPercentage])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditingPercentage) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const hotkeyIndex = indexFromHotkey(e.key)
      if (hotkeyIndex !== null) {
        const preset = percentages[hotkeyIndex]
        if (preset !== undefined) {
          e.preventDefault()
          applyPercentage(preset)
        }
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        cyclePreset(-1)
        return
      }

      if (e.key === ']') {
        e.preventDefault()
        cyclePreset(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyPercentage, cyclePreset, isEditingPercentage, percentages])

  useEffect(() => {
    const el = brushBarRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (isEditingPercentage) return
      e.preventDefault()
      cyclePreset(e.deltaY > 0 ? 1 : -1)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cyclePreset, isEditingPercentage])

  useEffect(() => {
    if (isEditingPercentage) {
      percentageInputRef.current?.focus()
      percentageInputRef.current?.select()
    }
  }, [isEditingPercentage])

  const handleBaseColorChange = (color: string) => {
    setBaseColor(color)
    saveBaseColor(color)
    setActiveBrush({ percentage: activeBrush.percentage, colorHex: color })
  }

  const handleAddPercentage = (value?: number) => {
    const num = value ?? parseFloat(newPercentageInput)
    if (isNaN(num) || num < 0 || num > 100) return false
    if (percentages.length >= MAX_PERCENTAGE_PRESETS) return false
    if (percentages.includes(num)) return false

    updatePercentages([...percentages, num])
    setNewPercentageInput('')
    setShowAddForm(false)
    return true
  }

  const handleDeletePercentage = (percentage: number) => {
    if (percentages.length <= 1) return

    const next = percentages.filter(p => p !== percentage)
    updatePercentages(next)

    if (activeBrush.percentage === percentage) {
      applyPercentage(next[0])
    }
  }

  const startEditingPercentage = () => {
    setPercentageInput(String(activeBrush.percentage))
    setIsEditingPercentage(true)
    setIsOpen(false)
  }

  const commitPercentageEdit = (saveAsPreset: boolean) => {
    const num = parseFloat(percentageInput)
    if (isNaN(num) || num < 0 || num > 100) {
      setIsEditingPercentage(false)
      return
    }

    applyPercentage(num)

    if (saveAsPreset) {
      handleAddPercentage(num)
    }

    setIsEditingPercentage(false)
  }

  const cancelPercentageEdit = () => {
    skipBlurCommitRef.current = true
    setIsEditingPercentage(false)
  }

  const handlePresetClick = (percentage: number) => {
    if (activeBrush.percentage === percentage) {
      startEditingPercentage()
      return
    }
    applyPercentage(percentage)
  }

  const canAddMore = percentages.length < MAX_PERCENTAGE_PRESETS

  const chipStyle = (percentage: number): CSSProperties => ({
    '--chip-color': baseColor,
    '--chip-opacity': percentageToOpacity(percentage),
  } as CSSProperties)

  const labelColor = getContrastTextColor(baseColor)

  return (
    <div ref={brushBarRef} className="brush-bar relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          setIsEditingPercentage(false)
        }}
        className="brush-bar-color"
        title={t('brush', 'settingsTooltip')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Paintbrush size={14} className="text-ink-light" />
        <span
          className="brush-bar-swatch"
          style={{
            backgroundColor: baseColor,
            opacity: percentageToOpacity(activeBrush.percentage),
          }}
        />
        <ChevronDown
          size={12}
          className={cn(
            'text-ink-faded transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <span className="brush-bar-divider" aria-hidden />

      {isEditingPercentage ? (
        <div className="brush-bar-edit">
          <input
            ref={percentageInputRef}
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={percentageInput}
            onChange={e => setPercentageInput(e.target.value)}
            onBlur={() => {
              if (skipBlurCommitRef.current) {
                skipBlurCommitRef.current = false
                return
              }
              commitPercentageEdit(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                skipBlurCommitRef.current = true
                commitPercentageEdit(e.shiftKey)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelPercentageEdit()
              }
            }}
            className="input-number w-14 text-center text-xs"
            title={t('brush', 'editPercentageHint')}
            aria-label={t('brush', 'editPercentage')}
          />
          <span className="text-ink-faded text-xs">%</span>
        </div>
      ) : (
        <div className="brush-bar-presets" role="group" aria-label={t('brush', 'resourceUsage')}>
          {percentages.map((percentage, index) => {
            const isActive = activeBrush.percentage === percentage
            const hotkey = hotkeyForIndex(index)

            return (
              <button
                key={percentage}
                type="button"
                onClick={() => handlePresetClick(percentage)}
                title={
                  hotkey
                    ? `${percentage}% (${t('brush', 'shortcutHint').replace('{n}', hotkey)})`
                    : `${percentage}%`
                }
                className={cn(
                  'brush-value-chip',
                  isActive && 'brush-value-chip-active'
                )}
                style={chipStyle(percentage)}
              >
                <span className="brush-value-label" style={{ color: labelColor }}>
                  {percentage}
                </span>
              </button>
            )
          })}

          {isOrphanValue && (
            <button
              type="button"
              onClick={startEditingPercentage}
              title={t('brush', 'editPercentageHint')}
              className="brush-value-chip brush-value-chip-active"
              style={chipStyle(activeBrush.percentage)}
            >
              <span className="brush-value-label" style={{ color: labelColor }}>
                {activeBrush.percentage}
              </span>
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute top-full right-0 mt-2 z-50 bg-surface rounded-lg shadow-lg border border-paper-lines p-4 w-72">
            <div className="mb-4">
              <label className="block text-xs text-ink-faded uppercase tracking-wide mb-2">
                {t('brush', 'baseColor')}
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleBaseColorChange(color)}
                    className={cn(
                      'w-6 h-6 rounded transition-transform hover:scale-110',
                      'flex items-center justify-center',
                      baseColor === color && 'ring-2 ring-ink ring-offset-1'
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {baseColor === color && (
                      <Check size={12} className="text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-ink-faded uppercase tracking-wide">
                  {t('brush', 'customValues')}
                </label>
                <span className="text-[11px] font-mono text-ink-faded">
                  {t('brush', 'presetsCount')
                    .replace('{count}', String(percentages.length))
                    .replace('{max}', String(MAX_PERCENTAGE_PRESETS))}
                </span>
              </div>

              <div className="brush-panel-presets mb-2">
                {percentages.map((percentage, index) => {
                  const isActive = activeBrush.percentage === percentage
                  const hotkey = hotkeyForIndex(index)
                  return (
                    <div key={percentage} className="brush-panel-preset">
                      <button
                        type="button"
                        onClick={() => {
                          applyPercentage(percentage)
                          setIsOpen(false)
                        }}
                        title={
                          hotkey
                            ? `${percentage}% (${t('brush', 'shortcutHint').replace('{n}', hotkey)})`
                            : `${percentage}%`
                        }
                        className={cn(
                          'brush-value-chip',
                          isActive && 'brush-value-chip-active'
                        )}
                        style={chipStyle(percentage)}
                      >
                        <span className="brush-value-label" style={{ color: labelColor }}>
                          {hotkey && (
                            <span className="opacity-70 font-sans font-semibold mr-1 text-[10px]">
                              {hotkey}
                            </span>
                          )}
                          {percentage}%
                        </span>
                      </button>
                      {percentages.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePercentage(percentage)
                          }}
                          className="brush-value-delete"
                          title={t('brush', 'removeCustomValue')}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {percentages.length <= 1 && (
                <p className="text-[11px] text-ink-faded mb-2">{t('brush', 'keepOne')}</p>
              )}

              {showAddForm ? (
                <div className="p-2.5 bg-paper-warm rounded">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={newPercentageInput}
                      onChange={e => setNewPercentageInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddPercentage()}
                      className="input-number flex-1"
                      placeholder={t('brush', 'placeholder')}
                      autoFocus
                    />
                    <span className="text-ink-light text-sm">%</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="p-1 text-ink-light hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPercentage()}
                      disabled={!canAddMore}
                      className={cn(
                        'p-1.5 rounded text-xs',
                        'bg-ink-blue text-white hover:bg-ink-blue/90',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <Save size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                canAddMore ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded border border-dashed border-paper-lines text-xs text-ink-faded hover:bg-paper-warm hover:text-ink-light hover:border-ink-faded transition-colors"
                  >
                    <Plus size={12} />
                    {t('brush', 'addCustomValue')}
                  </button>
                ) : (
                  <p className="text-xs text-ink-red">
                    {t('brush', 'maxReached')} ({MAX_PERCENTAGE_PRESETS})
                  </p>
                )
              )}
            </div>

            <p className="pt-3 border-t border-paper-lines text-[11px] text-ink-faded leading-relaxed">
              {t('brush', 'keyboardHints')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
