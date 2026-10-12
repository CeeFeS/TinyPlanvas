'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-context'
import * as api from './pocketbase-api'
import {
  DEFAULT_BASE_COLOR,
  DEFAULT_PERCENTAGES,
  MAX_CUSTOM_COLORS,
  MAX_PERCENTAGE_PRESETS,
  type UserPreferences,
} from './types'

// localStorage only caches the account values for an instant first paint
const STORAGE_KEY_PERCENTAGES = 'tinyplanvas-brush-percentages'
const LEGACY_STORAGE_KEY_PERCENTAGES = 'tinyplanvas-custom-percentages'
const STORAGE_KEY_BASE_COLOR = 'tinyplanvas-base-color'
const STORAGE_KEY_CUSTOM_COLORS = 'tinyplanvas-custom-colors'

const SAVE_DEBOUNCE_MS = 500

export function normalizePercentages(values: unknown): number[] | null {
  if (!Array.isArray(values)) return null
  const nums = values
    .map(v => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(n => !isNaN(n) && n >= 0 && n <= 100)
  const unique = [...new Set(nums)].sort((a, b) => a - b)
  if (unique.length === 0) return null
  return unique.slice(0, MAX_PERCENTAGE_PRESETS)
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  const long = /^#?([0-9a-f]{6})$/i.exec(v)
  return long ? `#${long[1]}`.toUpperCase() : null
}

function normalizeColors(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const colors = values.map(normalizeHexColor).filter((c): c is string => c !== null)
  return [...new Set(colors)].slice(0, MAX_CUSTOM_COLORS)
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.error('Failed to cache brush preferences:', e)
  }
}

function loadCachedPreferences(): Required<UserPreferences> {
  let percentages = normalizePercentages(readJson(STORAGE_KEY_PERCENTAGES))
  if (!percentages) {
    // Migrate legacy custom-only list → full preset list
    const legacy = normalizePercentages(readJson(LEGACY_STORAGE_KEY_PERCENTAGES))
    if (legacy) {
      percentages = normalizePercentages([...DEFAULT_PERCENTAGES, ...legacy])
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY_PERCENTAGES)
      } catch {}
    }
  }

  let baseColor: string | null = null
  try {
    baseColor = normalizeHexColor(localStorage.getItem(STORAGE_KEY_BASE_COLOR))
  } catch {}

  return {
    brushPercentages: percentages ?? [...DEFAULT_PERCENTAGES],
    brushBaseColor: baseColor ?? DEFAULT_BASE_COLOR,
    customColors: normalizeColors(readJson(STORAGE_KEY_CUSTOM_COLORS)),
  }
}

function hasAccountValues(prefs: UserPreferences | null | undefined): prefs is UserPreferences {
  return !!prefs && (
    prefs.brushPercentages !== undefined ||
    prefs.brushBaseColor !== undefined ||
    prefs.customColors !== undefined
  )
}

/**
 * Brush presets, base color and user-defined colors, persisted on the account
 * (users.preferences) so they follow the user across devices.
 */
export function useBrushPreferences() {
  const { user } = useAuth()
  const [percentages, setPercentagesState] = useState<number[]>([...DEFAULT_PERCENTAGES])
  const [baseColor, setBaseColorState] = useState<string>(DEFAULT_BASE_COLOR)
  const [customColors, setCustomColorsState] = useState<string[]>([])

  const pendingPatchRef = useRef<Partial<UserPreferences> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const migratedUserRef = useRef<string | null>(null)

  const apply = useCallback((prefs: UserPreferences) => {
    const p = normalizePercentages(prefs.brushPercentages)
    if (p) {
      setPercentagesState(p)
      writeCache(STORAGE_KEY_PERCENTAGES, JSON.stringify(p))
    }
    const c = normalizeHexColor(prefs.brushBaseColor)
    if (c) {
      setBaseColorState(c)
      writeCache(STORAGE_KEY_BASE_COLOR, c)
    }
    if (prefs.customColors !== undefined) {
      const colors = normalizeColors(prefs.customColors)
      setCustomColorsState(colors)
      writeCache(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(colors))
    }
  }, [])

  const flush = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const patch = pendingPatchRef.current
    if (!patch || !api.isAuthenticated()) return
    pendingPatchRef.current = null
    savingRef.current = true
    api
      .updateUserPreferences(patch)
      .catch((e) => console.error('Failed to save brush preferences:', e))
      .finally(() => {
        savingRef.current = false
      })
  }, [])

  const scheduleSave = useCallback((patch: Partial<UserPreferences>) => {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }, [flush])

  // Instant first paint from the local cache
  useEffect(() => {
    apply(loadCachedPreferences())
  }, [apply])

  // Account values win; an empty account adopts this device's values once
  const userId = user?.id
  const accountPrefsJson = JSON.stringify(user?.preferences ?? null)
  useEffect(() => {
    if (!userId) return
    // Local edits that are not saved yet must not be overwritten by stale data
    if (pendingPatchRef.current || savingRef.current) return

    const accountPrefs = JSON.parse(accountPrefsJson) as UserPreferences | null
    if (hasAccountValues(accountPrefs)) {
      apply(accountPrefs)
      return
    }
    if (migratedUserRef.current === userId) return
    migratedUserRef.current = userId
    scheduleSave(loadCachedPreferences())
  }, [userId, accountPrefsJson, apply, scheduleSave])

  // Never drop a pending change when the editor unmounts
  useEffect(() => flush, [flush])

  const setPercentages = useCallback((next: number[]) => {
    const normalized = normalizePercentages(next) ?? [...DEFAULT_PERCENTAGES]
    setPercentagesState(normalized)
    writeCache(STORAGE_KEY_PERCENTAGES, JSON.stringify(normalized))
    scheduleSave({ brushPercentages: normalized })
    return normalized
  }, [scheduleSave])

  const setBaseColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color)
    if (!normalized) return
    setBaseColorState(normalized)
    writeCache(STORAGE_KEY_BASE_COLOR, normalized)
    scheduleSave({ brushBaseColor: normalized })
  }, [scheduleSave])

  const setCustomColors = useCallback((next: string[]) => {
    const normalized = normalizeColors(next)
    setCustomColorsState(normalized)
    writeCache(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(normalized))
    scheduleSave({ customColors: normalized })
  }, [scheduleSave])

  return { percentages, setPercentages, baseColor, setBaseColor, customColors, setCustomColors }
}
