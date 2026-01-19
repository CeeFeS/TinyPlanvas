import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { 
  format, 
  parseISO, 
  eachDayOfInterval, 
  eachWeekOfInterval, 
  eachMonthOfInterval,
  eachYearOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  Locale,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
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
 * Formatiert ein Datum für die Header-Anzeige
 */
export function formatTimeSlotHeader(date: Date, resolution: Resolution): string {
  switch (resolution) {
    case 'day':
      return format(date, 'd', { locale: de })
    case 'week':
      return `KW${format(date, 'w', { locale: de })}`
    case 'month':
      return format(date, 'MMM', { locale: de })
    case 'year':
      return format(date, 'yyyy', { locale: de })
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

/**
 * Prüft ob ein Datum in einen Slot fällt
 */
export function isDateInSlot(date: Date, slotDate: Date, resolution: Resolution): boolean {
  switch (resolution) {
    case 'day':
      return isSameDay(date, slotDate)
    case 'week':
      return isSameWeek(date, slotDate, { weekStartsOn: 1 })
    case 'month':
      return isSameMonth(date, slotDate)
    case 'year':
      return isSameYear(date, slotDate)
  }
}

/**
 * Konvertiert Datum zu Slot-Key (für Map-Lookup)
 */
export function dateToSlotKey(date: Date, resolution: Resolution): string {
  switch (resolution) {
    case 'day':
      return format(date, 'yyyy-MM-dd')
    case 'week':
      // Start der Woche als Key
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM')
    case 'year':
      return format(startOfYear(date), 'yyyy')
  }
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
 * Generiert die nächste Display-ID für eine neue Task
 */
export function generateNextDisplayId(existingIds: string[]): string {
  // Versuche numerische IDs zu finden
  const numericIds = existingIds
    .map(id => parseInt(id, 10))
    .filter(n => !isNaN(n))
  
  if (numericIds.length === 0) {
    return '1'
  }
  
  return String(Math.max(...numericIds) + 1)
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

/**
 * Wählt passende Textfarbe (weiß/schwarz) basierend auf Hintergrund
 */
export function getContrastTextColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor)
  if (!rgb) return '#2D3436'
  
  // Berechne relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#2D3436' : '#FFFFFF'
}
