import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { 
  format, 
  parseISO, 
  eachDayOfInterval, 
  eachWeekOfInterval, 
  eachMonthOfInterval,
  eachYearOfInterval,
  Locale,
} from 'date-fns'
import { de } from 'date-fns/locale'
import type { Resolution, Allocation, ResourceWithAllocations, TaskWithAggregation } from './types'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== Date Utils ====================

/**
 * Generiert alle Zeitslots basierend auf Resolution
 */
export function generateTimeSlots(
  startDate: string, 
  endDate: string, 
  resolution: Resolution
): Date[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  
  switch (resolution) {
    case 'day':
      return eachDayOfInterval({ start, end })
    case 'week':
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
    case 'month':
      return eachMonthOfInterval({ start, end })
    case 'year':
      return eachYearOfInterval({ start, end })
  }
}

/**
 * Formatiert ein Datum für die Header-Anzeige.
 * Sprach-/Locale-abhängig: KW-Abkürzung und Monatskürzel richten sich nach der UI-Sprache.
 * - week:  de → "KW27", en → "W27"
 * - month: locale-abhängiges Kurzkürzel (de "Mär" / en "Mar" …)
 * - day/year: sprachneutrale Zahlen
 */
export function formatTimeSlotHeader(
  date: Date,
  resolution: Resolution,
  locale?: Locale,
  language?: 'de' | 'en'
): string {
  switch (resolution) {
    // Plain numbers: no locale involved, so skip the date-fns formatter.
    case 'day':
      return String(date.getDate())
    case 'year':
      return String(date.getFullYear())
    case 'week':
      return `${language === 'en' ? 'W' : 'KW'}${format(date, 'w', { locale: locale || de })}`
    case 'month':
      return format(date, 'MMM', { locale: locale || de })
  }
}

/**
 * Formatiert Monat/Jahr für Gruppierung
 */
export function formatTimeSlotGroup(date: Date, resolution: Resolution, locale?: Locale): string {
  const loc = locale || de
  switch (resolution) {
    case 'day':
      return format(date, 'MMMM yyyy', { locale: loc })
    case 'week':
      return format(date, 'MMMM yyyy', { locale: loc })
    case 'month':
      return format(date, 'yyyy', { locale: loc })
    case 'year':
      return '' // No grouping for years
  }
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

/**
 * Konvertiert Datum zu Slot-Key (für Map-Lookup).
 *
 * Hand-rolled instead of `format()`: this runs once per grid cell per render
 * (thousands of calls), where the date-fns formatter dominates the profile.
 */
export function dateToSlotKey(date: Date, resolution: Resolution): string {
  switch (resolution) {
    case 'day':
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    case 'week': {
      // Monday-based start of week as key
      const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`
    }
    case 'month':
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
    case 'year':
      return String(date.getFullYear())
  }
}

/** Slot keys for a whole time window - computed once, reused by every row. */
export function buildSlotKeys(slots: Date[], resolution: Resolution): string[] {
  const keys = new Array<string>(slots.length)
  for (let i = 0; i < slots.length; i++) {
    keys[i] = dateToSlotKey(slots[i], resolution)
  }
  return keys
}

// ==================== Aggregation Utils ====================

/**
 * Berechnet aggregierte Werte für eine Task basierend auf ihren Ressourcen
 */
export function computeTaskAggregation(
  resources: ResourceWithAllocations[]
): TaskWithAggregation['computed'] {
  if (resources.length === 0) {
    return {
      startDate: null,
      endDate: null,
      totalEffort: 0,
    }
  }

  let earliestDate: string | null = null
  let latestDate: string | null = null
  let totalEffort = 0

  for (const resource of resources) {
    for (const allocation of resource.allocations) {
      // Start Date
      if (!earliestDate || allocation.date < earliestDate) {
        earliestDate = allocation.date
      }
      // End Date
      if (!latestDate || allocation.date > latestDate) {
        latestDate = allocation.date
      }
      // Total Effort
      totalEffort += allocation.percentage
    }
  }

  return {
    startDate: earliestDate,
    endDate: latestDate,
    totalEffort,
  }
}

/**
 * Baut eine Allocation-Map für schnellen Zugriff
 */
export function buildAllocationMap(allocations: Allocation[]): Map<string, Allocation> {
  const map = new Map<string, Allocation>()
  for (const alloc of allocations) {
    map.set(alloc.date, alloc)
  }
  return map
}

// ==================== ID Generation ====================

/**
 * Generiert die nächste Display-ID für eine neue Root-Task
 * (nur reine numerische IDs wie "1", "2" — keine "1.1")
 */
export function generateNextDisplayId(existingIds: string[]): string {
  const numericIds = existingIds
    .map(id => {
      if (!/^\d+$/.test(id)) return NaN
      return parseInt(id, 10)
    })
    .filter(n => !isNaN(n))
  
  if (numericIds.length === 0) {
    return '1'
  }
  
  return String(Math.max(...numericIds) + 1)
}

/**
 * Generiert die nächste Display-ID für eine Unteraufgabe (z.B. "1.2")
 */
export function generateNextSubtaskDisplayId(
  parentDisplayId: string,
  siblingDisplayIds: string[]
): string {
  const prefix = `${parentDisplayId}.`
  const suffixes = siblingDisplayIds
    .filter(id => id.startsWith(prefix))
    .map(id => {
      const rest = id.slice(prefix.length)
      if (!/^\d+$/.test(rest)) return NaN
      return parseInt(rest, 10)
    })
    .filter(n => !isNaN(n))

  const next = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1
  return `${parentDisplayId}.${next}`
}

/** Merges two computed aggregations (e.g. own resources + children). */
export function mergeTaskComputed(
  a: TaskWithAggregation['computed'],
  b: TaskWithAggregation['computed']
): TaskWithAggregation['computed'] {
  let startDate = a.startDate
  let endDate = a.endDate
  if (b.startDate && (!startDate || b.startDate < startDate)) startDate = b.startDate
  if (b.endDate && (!endDate || b.endDate > endDate)) endDate = b.endDate
  return {
    startDate,
    endDate,
    totalEffort: a.totalEffort + b.totalEffort,
  }
}

/** Flatten root tasks + their children (one level). */
export function flattenTasksWithChildren(
  tasks: TaskWithAggregation[]
): TaskWithAggregation[] {
  const result: TaskWithAggregation[] = []
  for (const task of tasks) {
    result.push(task)
    if (task.children?.length) {
      result.push(...task.children)
    }
  }
  return result
}

// ==================== Color Utils ====================

/**
 * Berechnet Opacity basierend auf Prozent (für Chip-Darstellung)
 */
export function percentageToOpacity(percentage: number): number {
  // Minimum opacity von 0.3 für Sichtbarkeit
  return Math.max(0.3, Math.min(1, percentage / 100))
}

/**
 * Konvertiert HEX zu RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

// A project only ever uses a handful of distinct colors, but the contrast
// lookup happens per painted cell per render - so memoize it.
const contrastCache = new Map<string, string>()

/**
 * Wählt passende Textfarbe (weiß/schwarz) basierend auf Hintergrund
 */
export function getContrastTextColor(hexColor: string): string {
  const cached = contrastCache.get(hexColor)
  if (cached !== undefined) return cached

  const rgb = hexToRgb(hexColor)
  // Berechne relative luminance
  const color = !rgb
    ? '#2D3436'
    : (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.5
      ? '#2D3436'
      : '#FFFFFF'

  contrastCache.set(hexColor, color)
  return color
}

const NEUTRAL_CHIP_COLOR = '#E8E4DD'

/**
 * Blends allocation colors weighted by their percentage - used wherever several
 * resources share one cell (task rollups, resource summary).
 */
export function mixAllocationColors(
  colorData: { color: string; percentage: number }[]
): string {
  if (colorData.length === 0) return NEUTRAL_CHIP_COLOR
  if (colorData.length === 1) return colorData[0].color

  let totalWeight = 0
  let r = 0, g = 0, b = 0

  for (const { color, percentage } of colorData) {
    const rgb = hexToRgb(color)
    if (!rgb) continue
    r += rgb.r * percentage
    g += rgb.g * percentage
    b += rgb.b * percentage
    totalWeight += percentage
  }

  if (totalWeight === 0) return NEUTRAL_CHIP_COLOR

  const hex = (v: number) => Math.round(v / totalWeight).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
