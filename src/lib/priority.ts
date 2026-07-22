import type { Priority } from './types'

/**
 * Central priority configuration (Ampel-Logik / traffic-light scheme).
 *
 * Each priority maps to a base color that is used consistently across the UI
 * (dashboard badges, selection buttons, detail page). Badge styles are derived
 * from the base color at runtime so they work in both light and dark mode.
 */

export interface PriorityMeta {
  value: Priority
  /** i18n key under the "priorities" category */
  labelKey: string
  /** Base color (hex) used for dot, border and derived backgrounds */
  color: string
  /** Sort weight - lower = more urgent (used for ordering) */
  order: number
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  immediate: { value: 'immediate', labelKey: 'immediate', color: '#EF4444', order: 0 },
  high: { value: 'high', labelKey: 'high', color: '#F97316', order: 1 },
  medium: { value: 'medium', labelKey: 'medium', color: '#EAB308', order: 2 },
  low: { value: 'low', labelKey: 'low', color: '#22C55E', order: 3 },
  on_hold: { value: 'on_hold', labelKey: 'onHold', color: '#94A3B8', order: 4 },
}

export const PRIORITY_ORDER: Priority[] = ['immediate', 'high', 'medium', 'low', 'on_hold']

export function getPriorityMeta(priority?: Priority | null): PriorityMeta {
  if (priority && PRIORITY_META[priority]) return PRIORITY_META[priority]
  return PRIORITY_META.medium
}

/**
 * Convert a hex color (#RRGGBB) to an rgba() string with the given alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Inline style for a priority badge - subtle tinted background + colored text,
 * legible in both light and dark themes.
 */
export function getPriorityBadgeStyle(priority?: Priority | null): React.CSSProperties {
  const { color } = getPriorityMeta(priority)
  return {
    backgroundColor: hexToRgba(color, 0.15),
    color,
    borderColor: hexToRgba(color, 0.4),
  }
}
