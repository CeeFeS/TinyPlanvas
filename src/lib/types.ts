/**
 * TinyPlanvas - PocketBase Collection Types
 * 
 * Schema für PocketBase Collections:
 * 
 * === projects ===
 * - id: string (auto)
 * - user_id: relation -> users
 * - name: string
 * - resolution: select ["day", "week", "month", "year"]
 * - start_date: date
 * - end_date: date
 * - created: datetime (auto)
 * - updated: datetime (auto)
 * 
 * === tasks ===
 * - id: string (auto)
 * - project_id: relation -> projects
 * - display_id: string (z.B. "1", "1.1", "A-01")
 * - name: string
 * - sort_order: number
 * - created: datetime (auto)
 * - updated: datetime (auto)
 * 
 * === resources ===
 * - id: string (auto)
 * - task_id: relation -> tasks
 * - name: string
 * - sort_order: number
 * - created: datetime (auto)
 * - updated: datetime (auto)
 * 
 * === allocations ===
 * - id: string (auto)
 * - resource_id: relation -> resources
 * - date: date (ISO String)
 * - percentage: number (float, 0-100)
 * - color_hex: string (z.B. "#40C463")
 * - created: datetime (auto)
 * - updated: datetime (auto)
 */

// Base Record Type (PocketBase standard fields)
export interface BaseRecord {
  id: string
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
}

// Resolution Types für Zeitachse
export type Resolution = 'day' | 'week' | 'month' | 'year'

// ==================== DB Models ====================

export interface Project extends BaseRecord {
  user_id: string
  name: string
  resolution: Resolution
  start_date: string // ISO Date string
  end_date: string   // ISO Date string
}

export interface Task extends BaseRecord {
  project_id: string
  display_id: string
  name: string
  sort_order: number
}

export interface Resource extends BaseRecord {
  task_id: string
  name: string
  sort_order: number
}

export interface Allocation extends BaseRecord {
  resource_id: string
  date: string       // ISO Date string (nur Datum, ohne Zeit)
  percentage: number // 0-100
  color_hex: string  // z.B. "#40C463"
}

export interface Presence extends BaseRecord {
  project_id: string
  session_id: string
  user_name: string
  user_color: string // z.B. "#3182BD"
  last_seen: string  // ISO Date string
}

// ==================== Auth Types ====================

export interface User extends BaseRecord {
  email: string
  name: string
  avatar?: string
  isAdmin: boolean
  verified: boolean
}

export type PermissionLevel = 'view' | 'edit'

export interface ProjectPermission extends BaseRecord {
  user_id: string
  project_id: string
  permission_level: PermissionLevel
  // Expanded relations
  expand?: {
    user_id?: User
    project_id?: Project
  }
}

export interface UserWithPermissions extends User {
  permissions: ProjectPermission[]
}

// ==================== Expanded/Joined Types ====================

// Task mit aggregierten Daten
export interface TaskWithAggregation extends Task {
  resources: ResourceWithAllocations[]
  // Aggregierte Werte (berechnet aus Ressourcen)
  computed: {
    startDate: string | null  // Frühestes Allocation-Datum
    endDate: string | null    // Spätestes Allocation-Datum
    totalEffort: number       // Summe aller Allocations (Prozent)
  }
}

// Resource mit Allocations
export interface ResourceWithAllocations extends Resource {
  allocations: Allocation[]
  // Map für schnellen Zugriff: date -> allocation
  allocationMap: Map<string, Allocation>
}

// Komplettes Projekt mit allen Relations
export interface ProjectWithData extends Project {
  tasks: TaskWithAggregation[]
}

// ==================== UI State Types ====================

// Pinsel-Konfiguration
export interface BrushConfig {
  percentage: number
  colorHex: string // Grundfarbe - Opacity wird aus percentage berechnet
}

// Vordefinierte Prozent-Werte (nicht löschbar)
export const DEFAULT_PERCENTAGES = [25, 50, 75, 100] as const

// Standard-Grundfarbe
export const DEFAULT_BASE_COLOR = '#30A14E'

// Maximum number of custom percentage presets
export const MAX_CUSTOM_PRESETS = 10

// Color Palette für Custom Colors
export const COLOR_PALETTE = [
  // Greens (default)
  '#9BE9A8', '#40C463', '#30A14E', '#216E39',
  // Blues
  '#9ECAE1', '#6BAED6', '#3182BD', '#08519C',
  // Oranges
  '#FDAE6B', '#FD8D3C', '#E6550D', '#A63603',
  // Purples
  '#BCBDDC', '#9E9AC8', '#756BB1', '#54278F',
] as const

// Presence Colors für Nutzer-Avatare
export const PRESENCE_COLORS = [
  '#E53935', // Red
  '#8E24AA', // Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#00ACC1', // Cyan
  '#00897B', // Teal
  '#43A047', // Green
  '#F4511E', // Deep Orange
  '#6D4C41', // Brown
  '#546E7A', // Blue Grey
] as const

// ==================== Create/Update DTOs ====================

export interface CreateProjectDTO {
  name: string
  resolution: Resolution
  start_date: string
  end_date: string
}

export interface CreateTaskDTO {
  project_id: string
  display_id: string
  name: string
  sort_order?: number
}

export interface CreateResourceDTO {
  task_id: string
  name: string
  sort_order?: number
}

export interface CreateAllocationDTO {
  resource_id: string
  date: string
  percentage: number
  color_hex: string
}

export interface UpdateAllocationDTO {
  percentage?: number
  color_hex?: string
}

// Auth DTOs
export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterUserDTO {
  email: string
  password: string
  passwordConfirm: string
  name: string
}

export interface CreateUserDTO {
  email: string
  password: string
  passwordConfirm: string
  name: string
  isAdmin?: boolean
}

export interface UpdateUserDTO {
  name?: string
  isAdmin?: boolean
}

export interface CreatePermissionDTO {
  user_id: string
  project_id: string
  permission_level: PermissionLevel
}

export interface UpdatePermissionDTO {
  permission_level: PermissionLevel
}
