'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Paintbrush, ChevronDown, Check, Plus, X, Save } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { MAX_PERCENTAGE_PRESETS, MAX_CUSTOM_COLORS, COLOR_PALETTE } from '@/lib/types'
import { useBrushPreferences, normalizeHexColor } from '@/lib/use-brush-preferences'
import { cn, percentageToOpacity, getContrastTextColor } from '@/lib/utils'
import type { CSSProperties } from 'react'

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
  const {
    percentages,
    setPercentages: updatePercentages,
    baseColor,
    setBaseColor,
    customColors,
    setCustomColors,
  } = useBrushPreferences()
  const [showColorForm, setShowColorForm] = useState(false)
  const [newColorInput, setNewColorInput] = useState('#E6B000')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPercentageInput, setNewPercentageInput] = useState('')
  const [isEditingPercentage, setIsEditingPercentage] = useState(false)
  const [percentageInput, setPercentageInput] = useState('')
  const brushBarRef = useRef<HTMLDivElement>(null)
  const percentageInputRef = useRef<HTMLInputElement>(null)
  const skipBlurCommitRef = useRef(false)

  // Base color may arrive later from the account - keep the active brush in sync
  useEffect(() => {
    const brush = useProjectStore.getState().activeBrush
    if (brush.colorHex !== baseColor) {
      setActiveBrush({ ...brush, colorHex: baseColor })
    }
  }, [baseColor, setActiveBrush])

  const isOrphanValue = !percentages.includes(activeBrush.percentage)

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
  }

  const normalizedNewColor = normalizeHexColor(newColorInput)
  const canAddColor = customColors.length < MAX_CUSTOM_COLORS

  const handleAddColor = () => {
    if (!normalizedNewColor || !canAddColor) return
    const isKnown =
      (COLOR_PALETTE as readonly string[]).includes(normalizedNewColor) ||
      customColors.includes(normalizedNewColor)
    if (!isKnown) {
      setCustomColors([...customColors, normalizedNewColor])
    }
    setBaseColor(normalizedNewColor)
    setShowColorForm(false)
  }

  const handleRemoveColor = (color: string) => {
    setCustomColors(customColors.filter(c => c !== color))
  }

  // A previously chosen color that is no longer offered (e.g. old palette) stays usable
  const isLegacyBaseColor =
    !(COLOR_PALETTE as readonly string[]).includes(baseColor) && !customColors.includes(baseColor)

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
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    isActive={baseColor === color}
                    onSelect={() => handleBaseColorChange(color)}
                  />
                ))}
                {isLegacyBaseColor && (
                  <ColorSwatch color={baseColor} isActive onSelect={() => handleBaseColorChange(baseColor)} />
                )}
              </div>

              <div className="flex items-center justify-between mt-3 mb-2">
                <label className="text-xs text-ink-faded uppercase tracking-wide">
                  {t('brush', 'customColors')}
                </label>
                <span className="text-[11px] font-mono text-ink-faded">
                  {t('brush', 'presetsCount')
                    .replace('{count}', String(customColors.length))
                    .replace('{max}', String(MAX_CUSTOM_COLORS))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {customColors.map((color) => (
                  <div key={color} className="relative group/swatch">
                    <ColorSwatch
                      color={color}
                      isActive={baseColor === color}
                      onSelect={() => handleBaseColorChange(color)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-surface border border-paper-lines text-ink-faded hover:text-red-600 hidden group-hover/swatch:flex items-center justify-center"
                      title={t('brush', 'removeColor')}
                      aria-label={t('brush', 'removeColor')}
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
                {canAddColor && !showColorForm && (
                  <button
                    type="button"
                    onClick={() => setShowColorForm(true)}
                    className="w-6 h-6 rounded border border-dashed border-paper-lines text-ink-faded hover:text-ink hover:border-ink-faded flex items-center justify-center transition-colors"
                    title={t('brush', 'addColor')}
                    aria-label={t('brush', 'addColor')}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {showColorForm && (
                <div className="mt-2 p-2.5 bg-paper-warm rounded flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizedNewColor ?? '#000000'}
                    onChange={e => setNewColorInput(e.target.value.toUpperCase())}
                    className="w-8 h-8 p-0 border border-paper-lines rounded cursor-pointer bg-transparent flex-shrink-0"
                    aria-label={t('brush', 'pickColor')}
                  />
                  <input
                    type="text"
                    value={newColorInput}
                    onChange={e => setNewColorInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddColor()
                      if (e.key === 'Escape') setShowColorForm(false)
                    }}
                    className="input-notebook flex-1 min-w-0 font-mono text-xs uppercase"
                    placeholder="#RRGGBB"
                    maxLength={7}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowColorForm(false)}
                    className="p-1 text-ink-light hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    disabled={!normalizedNewColor}
                    className={cn(
                      'p-1.5 rounded text-xs',
                      'bg-ink-blue text-white hover:bg-ink-blue/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title={t('brush', 'addColor')}
                  >
                    <Save size={12} />
                  </button>
                </div>
              )}
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
              <br />
              {t('brush', 'syncedHint')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

interface ColorSwatchProps {
  color: string
  isActive: boolean
  onSelect: () => void
}

function ColorSwatch({ color, isActive, onSelect }: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-6 h-6 rounded transition-transform hover:scale-110',
        'flex items-center justify-center',
        isActive && 'ring-2 ring-ink ring-offset-1'
      )}
      style={{ backgroundColor: color }}
      title={color}
      aria-label={color}
      aria-pressed={isActive}
    >
      {isActive && (
        <Check size={12} className="drop-shadow-sm" style={{ color: getContrastTextColor(color) }} />
      )}
    </button>
  )
}
