'use client'

import { useState, useEffect } from 'react'
import { Paintbrush, ChevronDown, Check, Plus, X, Save } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { DEFAULT_PERCENTAGES, DEFAULT_BASE_COLOR, MAX_CUSTOM_PRESETS, COLOR_PALETTE } from '@/lib/types'
import { cn, percentageToOpacity } from '@/lib/utils'

const STORAGE_KEY_PERCENTAGES = 'tinyplanvas-custom-percentages'
const STORAGE_KEY_BASE_COLOR = 'tinyplanvas-base-color'

// Load custom percentages from localStorage
function loadCustomPercentages(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PERCENTAGES)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load custom percentages:', e)
  }
  return []
}

// Save custom percentages to localStorage
function saveCustomPercentages(percentages: number[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_PERCENTAGES, JSON.stringify(percentages))
  } catch (e) {
    console.error('Failed to save custom percentages:', e)
  }
}

// Load base color from localStorage
function loadBaseColor(): string {
  if (typeof window === 'undefined') return DEFAULT_BASE_COLOR
  try {
    const stored = localStorage.getItem(STORAGE_KEY_BASE_COLOR)
    if (stored) {
      return stored
    }
  } catch (e) {
    console.error('Failed to load base color:', e)
  }
  return DEFAULT_BASE_COLOR
}

// Save base color to localStorage
function saveBaseColor(color: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_BASE_COLOR, color)
  } catch (e) {
    console.error('Failed to save base color:', e)
  }
}

export function BrushEditor() {
  const { activeBrush, setActiveBrush } = useProjectStore()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [customPercentages, setCustomPercentages] = useState<number[]>([])
  const [baseColor, setBaseColor] = useState(DEFAULT_BASE_COLOR)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPercentageInput, setNewPercentageInput] = useState('')

  // Load saved data on mount
  useEffect(() => {
    setCustomPercentages(loadCustomPercentages())
    const savedColor = loadBaseColor()
    setBaseColor(savedColor)
    // Update active brush with saved color
    setActiveBrush({ ...activeBrush, colorHex: savedColor })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // All percentages combined and sorted
  const allPercentages = [...DEFAULT_PERCENTAGES, ...customPercentages].sort((a, b) => a - b)

  const handlePercentageClick = (percentage: number) => {
    setActiveBrush({ percentage, colorHex: baseColor })
  }

  const handleBaseColorChange = (color: string) => {
    setBaseColor(color)
    saveBaseColor(color)
    setActiveBrush({ ...activeBrush, colorHex: color })
  }

  const handleAddCustomPercentage = () => {
    const num = parseFloat(newPercentageInput)
    if (isNaN(num) || num < 0 || num > 100) return
    if (customPercentages.length >= MAX_CUSTOM_PRESETS) return

    // Check if already exists (in default or custom)
    if (DEFAULT_PERCENTAGES.includes(num as typeof DEFAULT_PERCENTAGES[number]) || 
        customPercentages.includes(num)) {
      return
    }

    const newCustomPercentages = [...customPercentages, num].sort((a, b) => a - b)
    setCustomPercentages(newCustomPercentages)
    saveCustomPercentages(newCustomPercentages)
    setNewPercentageInput('')
    setShowAddForm(false)
  }

  const handleDeleteCustomPercentage = (percentage: number) => {
    const newCustomPercentages = customPercentages.filter(p => p !== percentage)
    setCustomPercentages(newCustomPercentages)
    saveCustomPercentages(newCustomPercentages)
  }

  const isDefaultPercentage = (p: number) => DEFAULT_PERCENTAGES.includes(p as typeof DEFAULT_PERCENTAGES[number])

  return (
    <div className="relative">
      {/* Brush Preview Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="brush-preview hover:shadow-paper-hover transition-shadow"
      >
        <Paintbrush size={16} className="text-ink-light" />
        
        {/* Current color chip with opacity based on percentage */}
        <div 
          className="w-5 h-5 rounded border border-black/10"
          style={{ 
            backgroundColor: baseColor,
            opacity: percentageToOpacity(activeBrush.percentage)
          }}
        />
        
        {/* Current percentage */}
        <span className="font-mono text-sm text-ink">
          {activeBrush.percentage}%
        </span>
        
        <ChevronDown 
          size={14} 
          className={cn(
            'text-ink-faded transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Overlay to close */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-paper-lines p-4 w-80">
            
            {/* Base Color Selection */}
            <div className="mb-4">
              <label className="block text-xs text-ink-faded uppercase tracking-wide mb-2">
                {t('brush', 'baseColor')}
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleBaseColorChange(color)}
                    className={cn(
                      'w-7 h-7 rounded transition-transform hover:scale-110',
                      'flex items-center justify-center',
                      baseColor === color && 'ring-2 ring-ink ring-offset-1'
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {baseColor === color && (
                      <Check size={14} className="text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Percentage Presets */}
            <div className="mb-4">
              <label className="block text-xs text-ink-faded uppercase tracking-wide mb-2">
                {t('brush', 'resourceUsage')}
              </label>
              <div className="flex flex-wrap gap-2">
                {allPercentages.map((percentage) => {
                  const isDefault = isDefaultPercentage(percentage)
                  const isActive = activeBrush.percentage === percentage
                  
                  return (
                    <div key={percentage} className="relative group">
                      <button
                        onClick={() => handlePercentageClick(percentage)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono transition-all',
                          isActive
                            ? 'bg-ink-blue text-white'
                            : 'bg-paper-warm text-ink hover:bg-paper-lines',
                          !isDefault && 'pr-7'
                        )}
                      >
                        {/* Mini preview chip */}
                        <div 
                          className="w-3 h-3 rounded-sm border border-black/10"
                          style={{ 
                            backgroundColor: baseColor,
                            opacity: percentageToOpacity(percentage)
                          }}
                        />
                        {percentage}%
                      </button>
                      
                      {/* Delete button for custom percentages */}
                      {!isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCustomPercentage(percentage)
                          }}
                          className={cn(
                            'absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            'hover:bg-ink-red/20 text-ink-faded hover:text-ink-red'
                          )}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add Custom Percentage */}
            {showAddForm ? (
              <div className="mb-4 p-3 bg-paper-warm rounded-lg">
                <label className="block text-xs text-ink-faded uppercase tracking-wide mb-2">
                  {t('brush', 'saveNewValue')}
                </label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newPercentageInput}
                    onChange={e => setNewPercentageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomPercentage()}
                    className="input-number flex-1"
                    placeholder={t('brush', 'placeholder')}
                    autoFocus
                  />
                  <span className="text-ink-light text-sm">%</span>
                  
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="p-1.5 text-ink-light hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handleAddCustomPercentage}
                    disabled={customPercentages.length >= MAX_CUSTOM_PRESETS}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded text-xs',
                      'bg-ink-blue text-white hover:bg-ink-blue/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <Save size={12} />
                  </button>
                </div>
                
                {customPercentages.length >= MAX_CUSTOM_PRESETS && (
                  <p className="text-xs text-ink-red mt-2">
                    {t('brush', 'maxReached')} ({MAX_CUSTOM_PRESETS} {t('brush', 'customValues')})
                  </p>
                )}
              </div>
            ) : (
              customPercentages.length < MAX_CUSTOM_PRESETS && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 mb-4 rounded border border-dashed border-paper-lines text-sm text-ink-light hover:bg-paper-warm hover:border-ink-faded transition-colors"
                >
                  <Plus size={14} />
                  {t('brush', 'addCustomValue')} ({customPercentages.length}/{MAX_CUSTOM_PRESETS})
                </button>
              )
            )}

            {/* Opacity Preview Scale */}
            <div className="mt-4 pt-3 border-t border-paper-lines">
              <label className="block text-xs text-ink-faded uppercase tracking-wide mb-2">
                {t('brush', 'intensityScale')}
              </label>
              <div className="flex items-center gap-1">
                {[10, 25, 50, 75, 100].map((p) => (
                  <div key={p} className="flex-1 text-center">
                    <div 
                      className="w-full h-6 rounded border border-black/10 mb-1"
                      style={{ 
                        backgroundColor: baseColor,
                        opacity: percentageToOpacity(p)
                      }}
                    />
                    <span className="text-[10px] font-mono text-ink-faded">{p}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Brush Info */}
            <div className="mt-4 pt-3 border-t border-paper-lines">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-faded">{t('brush', 'activeBrush')}:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border border-black/10"
                    style={{ 
                      backgroundColor: baseColor,
                      opacity: percentageToOpacity(activeBrush.percentage)
                    }}
                  />
                  <span className="font-mono text-sm font-medium">{activeBrush.percentage}%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
