import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { 
  type Project, 
  type Task, 
  type Resource, 
  type Allocation,
  type Presence,
  type BrushConfig,
  type TaskWithAggregation,
  type ResourceWithAllocations,
  type CustomColumn,
  type CustomValue,
  type CustomRowType,
  DEFAULT_BASE_COLOR,
} from '@/lib/types'
import {
  computeTaskAggregation,
  buildAllocationMap,
  mergeTaskComputed,
  generateNextDisplayId,
  generateNextSubtaskDisplayId,
} from '@/lib/utils'
import * as api from '@/lib/pocketbase-api'
import type { RecordSubscription } from 'pocketbase'

// ==================== State Types ====================

interface ProjectState {
  // Current project data
  project: Project | null
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]

  // Custom columns feature
  customColumns: CustomColumn[]
  customValues: CustomValue[]
  
  // User's permission level for current project
  userPermission: 'owner' | 'edit' | 'view' | null
  
  // Computed/derived data (für schnellen Zugriff)
  tasksWithData: TaskWithAggregation[]
  
  // UI State
  isLoading: boolean
  isSaving: boolean
  error: string | null
  
  // Brush state
  activeBrush: BrushConfig
  isPainting: boolean
  
  // Realtime subscription
  subscription: api.ProjectSubscription | null
  
  // Presence state
  presenceList: Presence[]
  sessionId: string
  userName: string
  userColor: string
  presenceSubscription: api.RealtimeUnsubscribe | null
  presenceInterval: ReturnType<typeof setInterval> | null
}

export interface ProjectActions {
  // Data loading
  setProject: (project: Project) => void
  setAllData: (data: {
    project: Project
    tasks: Task[]
    resources: Resource[]
    allocations: Allocation[]
    customColumns?: CustomColumn[]
    customValues?: CustomValue[]
    userPermission: 'owner' | 'edit' | 'view' | null
  }) => void
  
  // Permission helpers
  canEdit: () => boolean
  
  // API: Load project with all data
  loadProject: (projectId: string, realUserName?: string) => Promise<void>
  
  // Task CRUD (with API)
  addTask: (task: Task) => void
  createTaskAsync: (
    projectId: string,
    displayId: string,
    name: string,
    parentId?: string | null
  ) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => void
  updateTaskAsync: (id: string, updates: Partial<Task>) => Promise<void>
  /** Indent/outdent: attach a task to a new parent (null = root). Returns false if not allowed. */
  moveTaskAsync: (id: string, newParentId: string | null) => Promise<boolean>
  /** Re-derives subtask display ids ("1.1", "1.2", …) from their position. */
  renumberSubtasksAsync: (parentId: string) => Promise<void>
  deleteTask: (id: string) => void
  deleteTaskAsync: (id: string) => Promise<void>
  
  // Resource CRUD (with API)
  addResource: (resource: Resource) => void
  createResourceAsync: (taskId: string, name: string) => Promise<Resource>
  updateResource: (id: string, updates: Partial<Resource>) => void
  updateResourceAsync: (id: string, updates: Partial<Resource>) => Promise<void>
  deleteResource: (id: string) => void
  deleteResourceAsync: (id: string) => Promise<void>
  
  // Allocation CRUD (with API)
  setAllocation: (resourceId: string, date: string, percentage: number, colorHex: string) => void
  setAllocationAsync: (resourceId: string, date: string, percentage: number, colorHex: string) => Promise<void>
  removeAllocation: (resourceId: string, date: string) => void
  removeAllocationAsync: (resourceId: string, date: string) => Promise<void>

  // Custom columns CRUD
  createCustomColumnAsync: (projectId: string, name: string) => Promise<CustomColumn>
  updateCustomColumnAsync: (id: string, patch: { name?: string; width?: number }) => Promise<void>
  deleteCustomColumnAsync: (id: string) => Promise<void>
  setCustomValueAsync: (columnId: string, rowType: CustomRowType, rowId: string, value: string) => Promise<void>
  getCustomValue: (columnId: string, rowType: CustomRowType, rowId: string) => string
  
  // Realtime event handlers
  handleProjectChange: (event: RecordSubscription<Project>) => void
  handleTaskChange: (event: RecordSubscription<Task>) => void
  handleResourceChange: (event: RecordSubscription<Resource>) => void
  handleAllocationChange: (event: RecordSubscription<Allocation>) => void
  handleCustomColumnChange: (event: RecordSubscription<CustomColumn>) => void
  handleCustomValueChange: (event: RecordSubscription<CustomValue>) => void
  handlePresenceChange: (event: RecordSubscription<Presence>) => void
  
  // Subscribe to realtime updates
  subscribeToProject: (projectId: string) => Promise<void>
  unsubscribeFromProject: () => Promise<void>
  
  // Presence management
  initializePresence: (realUserName?: string) => void
  startPresence: (projectId: string) => Promise<void>
  stopPresence: () => Promise<void>
  getOtherUsers: () => Presence[]
  
  // Brush
  setActiveBrush: (brush: BrushConfig) => void
  setIsPainting: (isPainting: boolean) => void
  
  // Recompute aggregations
  recomputeAggregations: () => void
  
  // UI State
  setIsLoading: (loading: boolean) => void
  setIsSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  
  // Reset
  reset: () => void
}

export type ProjectStore = ProjectState & ProjectActions

// ==================== Initial State ====================

const initialState: ProjectState = {
  project: null,
  tasks: [],
  resources: [],
  allocations: [],
  customColumns: [],
  customValues: [],
  userPermission: null,
  tasksWithData: [],
  isLoading: false,
  isSaving: false,
  error: null,
  activeBrush: { percentage: 50, colorHex: DEFAULT_BASE_COLOR },
  isPainting: false,
  subscription: null,
  presenceList: [],
  sessionId: '',
  userName: '',
  userColor: '',
  presenceSubscription: null,
  presenceInterval: null,
}

// ==================== Helper Functions ====================

/**
 * Builds the denormalized task tree.
 *
 * Grouping is done via lookup maps rather than nested `filter()` calls: the
 * naive version was O(tasks × resources + resources × allocations), which
 * dominated every mutation in projects with a few thousand allocations.
 */
function computeTasksWithData(
  tasks: Task[],
  resources: Resource[],
  allocations: Allocation[]
): TaskWithAggregation[] {
  const allocationsByResource = new Map<string, Allocation[]>()
  for (const allocation of allocations) {
    const list = allocationsByResource.get(allocation.resource_id)
    if (list) list.push(allocation)
    else allocationsByResource.set(allocation.resource_id, [allocation])
  }

  const resourcesByTask = new Map<string, ResourceWithAllocations[]>()
  for (const resource of resources) {
    const resourceAllocations = allocationsByResource.get(resource.id) ?? []
    const enrichedResource: ResourceWithAllocations = {
      ...resource,
      allocations: resourceAllocations,
      allocationMap: buildAllocationMap(resourceAllocations),
    }
    const list = resourcesByTask.get(resource.task_id)
    if (list) list.push(enrichedResource)
    else resourcesByTask.set(resource.task_id, [enrichedResource])
  }

  const enriched = tasks.map(task => {
    const resourcesWithAllocations = resourcesByTask.get(task.id) ?? []
    return {
      ...task,
      parent_id: task.parent_id || undefined,
      resources: resourcesWithAllocations,
      children: [] as TaskWithAggregation[],
      computed: computeTaskAggregation(resourcesWithAllocations),
    }
  })

  const byId = new Map(enriched.map(t => [t.id, t]))
  const roots: TaskWithAggregation[] = []

  for (const task of enriched) {
    const parentId = task.parent_id
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(task)
    } else {
      roots.push(task)
    }
  }

  // Sort siblings and roll parent aggregation up from children
  const sortByOrder = (a: TaskWithAggregation, b: TaskWithAggregation) =>
    a.sort_order - b.sort_order

  for (const root of roots) {
    root.children.sort(sortByOrder)
    for (const child of root.children) {
      root.computed = mergeTaskComputed(root.computed, child.computed)
    }
  }

  return roots.sort(sortByOrder)
}

/** Recomputes a task's aggregation from its own resources + children rollup. */
function withRecomputedAggregation(task: TaskWithAggregation): TaskWithAggregation {
  let computed = computeTaskAggregation(task.resources)
  for (const child of task.children) {
    computed = mergeTaskComputed(computed, child.computed)
  }
  return { ...task, computed }
}

function withPatchedAllocation(
  resource: ResourceWithAllocations,
  date: string,
  allocation: Allocation | null
): ResourceWithAllocations {
  const allocationMap = new Map(resource.allocationMap)
  if (allocation) allocationMap.set(date, allocation)
  else allocationMap.delete(date)

  return {
    ...resource,
    allocations: Array.from(allocationMap.values()),
    allocationMap,
  }
}

/**
 * Applies a single allocation change to the task tree without rebuilding it.
 *
 * Painting a cell used to trigger a full `computeTasksWithData()` pass, which
 * replaced every task object and forced the whole grid to re-render. Here only
 * the touched resource, its task and (if nested) its parent get new
 * identities - every other row keeps its reference and stays memoized.
 */
function patchAllocationInTree(
  tree: TaskWithAggregation[],
  resourceId: string,
  date: string,
  allocation: Allocation | null
): TaskWithAggregation[] {
  const patchWithin = (task: TaskWithAggregation): TaskWithAggregation | null => {
    const index = task.resources.findIndex(r => r.id === resourceId)
    if (index === -1) return null
    const resources = task.resources.slice()
    resources[index] = withPatchedAllocation(resources[index], date, allocation)
    return withRecomputedAggregation({ ...task, resources })
  }

  for (let i = 0; i < tree.length; i++) {
    const root = tree[i]

    const patchedRoot = patchWithin(root)
    if (patchedRoot) {
      const next = tree.slice()
      next[i] = patchedRoot
      return next
    }

    for (let j = 0; j < root.children.length; j++) {
      const patchedChild = patchWithin(root.children[j])
      if (!patchedChild) continue
      const children = root.children.slice()
      children[j] = patchedChild
      const next = tree.slice()
      next[i] = withRecomputedAggregation({ ...root, children })
      return next
    }
  }

  return tree
}

/** Finds an enriched resource in the task tree without allocating intermediates. */
export function findResourceInTree(
  tree: TaskWithAggregation[],
  resourceId: string
): ResourceWithAllocations | undefined {
  for (const root of tree) {
    for (const resource of root.resources) {
      if (resource.id === resourceId) return resource
    }
    for (const child of root.children) {
      for (const resource of child.resources) {
        if (resource.id === resourceId) return resource
      }
    }
  }
  return undefined
}

/**
 * Next free sort order within a sibling group. Using max+1 (instead of count+1)
 * keeps ordering stable in projects where earlier siblings were deleted.
 */
function nextSortOrder(siblings: Task[]): number {
  if (siblings.length === 0) return 1
  return Math.max(...siblings.map(s => s.sort_order ?? 0)) + 1
}

// ==================== Store ====================

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    ...initialState,
    
    // Data loading
    setProject: (project) => set((state) => {
      state.project = project
    }),
    
    setAllData: (data) => set((state) => {
      state.project = data.project
      state.tasks = data.tasks
      state.resources = data.resources
      state.allocations = data.allocations
      state.customColumns = data.customColumns ?? []
      state.customValues = data.customValues ?? []
      state.userPermission = data.userPermission
      state.tasksWithData = computeTasksWithData(
        data.tasks, 
        data.resources, 
        data.allocations
      )
      state.isLoading = false
      state.error = null
    }),
    
    // Permission helper: Check if user can edit (owner or edit permission)
    canEdit: () => {
      const permission = get().userPermission
      return permission === 'owner' || permission === 'edit'
    },
    
    // API: Load project with all data
    loadProject: async (projectId: string, realUserName?: string) => {
      set((state) => { 
        state.isLoading = true 
        state.error = null
      })
      
      try {
        // Initialize presence first (generates session ID, uses real name if provided)
        get().initializePresence(realUserName)
        
        const data = await api.fetchProjectFullData(projectId)
        get().setAllData(data)
        
        // Setup realtime subscription (await for connection to be ready)
        await get().subscribeToProject(projectId)
        
        // Start presence tracking
        await get().startPresence(projectId)
      } catch (error) {
        set((state) => {
          state.isLoading = false
          state.error = error instanceof Error ? error.message : 'Fehler beim Laden'
        })
        throw error
      }
    },
    
    // Task CRUD
    addTask: (task) => set((state) => {
      state.tasks.push(task)
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
    }),
    
    createTaskAsync: async (projectId, displayId, name, parentId) => {
      const siblings = get().tasks.filter(t =>
        parentId ? t.parent_id === parentId : !t.parent_id
      )
      const sortOrder = nextSortOrder(siblings)
      
      // Optimistic update with temp ID
      const tempId = `temp_${Date.now()}`
      const tempTask: Task = {
        id: tempId,
        project_id: projectId,
        display_id: displayId,
        name,
        sort_order: sortOrder,
        ...(parentId ? { parent_id: parentId } : {}),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      get().addTask(tempTask)
      
      try {
        // Create in database
        const newTask = await api.createTask({
          project_id: projectId,
          display_id: displayId,
          name,
          sort_order: sortOrder,
          ...(parentId ? { parent_id: parentId } : {}),
        })
        
        // Replace temp task with real one (or verify realtime already did it)
        set((state) => {
          const tempIndex = state.tasks.findIndex(t => t.id === tempId)
          const realIndex = state.tasks.findIndex(t => t.id === newTask.id)
          
          if (tempIndex !== -1 && realIndex === -1) {
            // Normal case: replace temp with real
            state.tasks[tempIndex] = newTask
          } else if (tempIndex !== -1 && realIndex !== -1) {
            // Realtime already added it, remove temp
            state.tasks.splice(tempIndex, 1)
          }
          // If tempIndex === -1, realtime already replaced it
          
          state.tasksWithData = computeTasksWithData(
            state.tasks,
            state.resources,
            state.allocations
          )
          // Update subscription with new task ID
          if (state.subscription) {
            state.subscription.updateTaskIds(state.tasks.map(t => t.id))
          }
        })
        
        return newTask
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.tasks = state.tasks.filter(t => t.id !== tempId)
          state.tasksWithData = computeTasksWithData(
            state.tasks,
            state.resources,
            state.allocations
          )
          state.error = error instanceof Error ? error.message : 'Fehler beim Erstellen'
        })
        throw error
      }
    },
    
    updateTask: (id, updates) => set((state) => {
      const index = state.tasks.findIndex(t => t.id === id)
      if (index !== -1) {
        Object.assign(state.tasks[index], updates)
        state.tasksWithData = computeTasksWithData(
          state.tasks,
          state.resources,
          state.allocations
        )
      }
    }),
    
    updateTaskAsync: async (id, updates) => {
      // Skip temp IDs
      if (id.startsWith('temp_')) return
      
      // Optimistic update
      const originalTask = get().tasks.find(t => t.id === id)
      get().updateTask(id, updates)
      
      try {
        await api.updateTask(id, updates)

        // Renaming a parent's id re-prefixes its subtasks ("2" -> "5" => "5.1", …)
        if (updates.display_id !== undefined) {
          const task = get().tasks.find(t => t.id === id)
          const hasChildren = get().tasks.some(t => t.parent_id === id)
          if (task && !task.parent_id && hasChildren) {
            await get().renumberSubtasksAsync(id)
          }
        }
      } catch (error) {
        // Rollback on error
        if (originalTask) {
          get().updateTask(id, originalTask)
        }
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Fehler beim Aktualisieren'
        })
        throw error
      }
    },

    renumberSubtasksAsync: async (parentId) => {
      const parent = get().tasks.find(t => t.id === parentId)
      if (!parent) return

      const children = get().tasks
        .filter(t => t.parent_id === parentId && !t.id.startsWith('temp_'))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      const pending: Promise<void>[] = []
      children.forEach((child, index) => {
        const expected = `${parent.display_id}.${index + 1}`
        if (child.display_id !== expected) {
          pending.push(get().updateTaskAsync(child.id, { display_id: expected }))
        }
      })

      await Promise.all(pending)
    },

    moveTaskAsync: async (id, newParentId) => {
      if (id.startsWith('temp_')) return false

      const tasks = get().tasks
      const task = tasks.find(t => t.id === id)
      if (!task) return false

      const currentParentId = task.parent_id || null
      if (currentParentId === newParentId) return false

      // Only one nesting level: a task that has subtasks cannot become a subtask
      if (newParentId && tasks.some(t => t.parent_id === id)) return false

      const newParent = newParentId ? tasks.find(t => t.id === newParentId) : null
      if (newParentId && (!newParent || newParent.parent_id)) return false

      const siblings = tasks.filter(
        t => t.id !== id && (newParentId ? t.parent_id === newParentId : !t.parent_id)
      )

      let sortOrder: number
      let displayId: string

      if (newParent) {
        sortOrder = nextSortOrder(siblings)
        displayId = generateNextSubtaskDisplayId(
          newParent.display_id,
          siblings.map(s => s.display_id)
        )
      } else {
        // Outdent: land between the former parent and the next root task.
        // Halving the gap keeps repeated outdents from colliding on one value.
        const oldParent = currentParentId ? tasks.find(t => t.id === currentParentId) : null
        if (oldParent) {
          const parentOrder = oldParent.sort_order ?? 0
          const nextRootOrder = siblings
            .map(s => s.sort_order ?? 0)
            .filter(order => order > parentOrder)
            .sort((a, b) => a - b)[0]
          sortOrder = nextRootOrder !== undefined
            ? (parentOrder + nextRootOrder) / 2
            : parentOrder + 1
        } else {
          sortOrder = nextSortOrder(siblings)
        }
        displayId = generateNextDisplayId(siblings.map(s => s.display_id))
      }

      try {
        await get().updateTaskAsync(id, {
          parent_id: newParentId ?? '',
          sort_order: sortOrder,
          display_id: displayId,
        })
      } catch {
        return false
      }

      // Close the gap in the group the task left
      if (currentParentId) {
        await get().renumberSubtasksAsync(currentParentId)
      }

      return true
    },
    
    deleteTask: (id) => set((state) => {
      // Collect task + direct children (one nesting level)
      const idsToDelete = new Set<string>([id])
      for (const t of state.tasks) {
        if (t.parent_id === id) idsToDelete.add(t.id)
      }

      state.tasks = state.tasks.filter(t => !idsToDelete.has(t.id))
      const resourceIds = state.resources
        .filter(r => idsToDelete.has(r.task_id))
        .map(r => r.id)
      state.resources = state.resources.filter(r => !idsToDelete.has(r.task_id))
      state.allocations = state.allocations.filter(
        a => !resourceIds.includes(a.resource_id)
      )
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
      // Update subscription
      if (state.subscription) {
        state.subscription.updateTaskIds(state.tasks.map(t => t.id))
        state.subscription.updateResourceIds(state.resources.map(r => r.id))
      }
    }),
    
    deleteTaskAsync: async (id) => {
      if (id.startsWith('temp_')) {
        get().deleteTask(id)
        return
      }
      
      const formerParentId = get().tasks.find(t => t.id === id)?.parent_id || null
      const childTasks = get().tasks.filter(t => t.parent_id === id)
      const idsToDelete = [id, ...childTasks.map(t => t.id)]
      const originalTasks = get().tasks.filter(t => idsToDelete.includes(t.id))
      const originalResources = get().resources.filter(r => idsToDelete.includes(r.task_id))
      const resourceIds = originalResources.map(r => r.id)
      const originalAllocations = get().allocations.filter(a => resourceIds.includes(a.resource_id))
      
      // Optimistic delete
      get().deleteTask(id)
      
      try {
        await api.deleteTask(id)
        if (formerParentId) {
          await get().renumberSubtasksAsync(formerParentId)
        }
      } catch (error) {
        // Rollback on error
        if (originalTasks.length > 0) {
          set((state) => {
            state.tasks.push(...originalTasks)
            state.resources.push(...originalResources)
            state.allocations.push(...originalAllocations)
            state.tasksWithData = computeTasksWithData(
              state.tasks,
              state.resources,
              state.allocations
            )
            state.error = error instanceof Error ? error.message : 'Fehler beim Löschen'
          })
        }
        throw error
      }
    },
    
    // Resource CRUD
    addResource: (resource) => set((state) => {
      state.resources.push(resource)
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
    }),
    
    createResourceAsync: async (taskId, name) => {
      const taskResources = get().resources.filter(r => r.task_id === taskId)
      const sortOrder = taskResources.length + 1
      
      const tempId = `temp_${Date.now()}`
      const tempResource: Resource = {
        id: tempId,
        task_id: taskId,
        name,
        sort_order: sortOrder,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      get().addResource(tempResource)
      
      try {
        const newResource = await api.createResource({
          task_id: taskId,
          name,
          sort_order: sortOrder,
        })
        
        set((state) => {
          const tempIndex = state.resources.findIndex(r => r.id === tempId)
          const realIndex = state.resources.findIndex(r => r.id === newResource.id)
          
          if (tempIndex !== -1 && realIndex === -1) {
            // Normal case: replace temp with real
            state.resources[tempIndex] = newResource
          } else if (tempIndex !== -1 && realIndex !== -1) {
            // Realtime already added it, remove temp
            state.resources.splice(tempIndex, 1)
          }
          
          state.tasksWithData = computeTasksWithData(
            state.tasks,
            state.resources,
            state.allocations
          )
          // Update subscription with new resource ID
          if (state.subscription) {
            state.subscription.updateResourceIds(state.resources.map(r => r.id))
          }
        })
        
        return newResource
      } catch (error) {
        set((state) => {
          state.resources = state.resources.filter(r => r.id !== tempId)
          state.tasksWithData = computeTasksWithData(
            state.tasks,
            state.resources,
            state.allocations
          )
          state.error = error instanceof Error ? error.message : 'Fehler beim Erstellen'
        })
        throw error
      }
    },
    
    updateResource: (id, updates) => set((state) => {
      const index = state.resources.findIndex(r => r.id === id)
      if (index !== -1) {
        Object.assign(state.resources[index], updates)
        state.tasksWithData = computeTasksWithData(
          state.tasks,
          state.resources,
          state.allocations
        )
      }
    }),
    
    updateResourceAsync: async (id, updates) => {
      if (id.startsWith('temp_')) return
      
      const originalResource = get().resources.find(r => r.id === id)
      get().updateResource(id, updates)
      
      try {
        await api.updateResource(id, updates)
      } catch (error) {
        if (originalResource) {
          get().updateResource(id, originalResource)
        }
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Fehler beim Aktualisieren'
        })
        throw error
      }
    },
    
    deleteResource: (id) => set((state) => {
      state.resources = state.resources.filter(r => r.id !== id)
      state.allocations = state.allocations.filter(a => a.resource_id !== id)
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
      // Update subscription
      if (state.subscription) {
        state.subscription.updateResourceIds(state.resources.map(r => r.id))
      }
    }),
    
    deleteResourceAsync: async (id) => {
      if (id.startsWith('temp_')) {
        get().deleteResource(id)
        return
      }
      
      const originalResource = get().resources.find(r => r.id === id)
      const originalAllocations = get().allocations.filter(a => a.resource_id === id)
      
      get().deleteResource(id)
      
      try {
        await api.deleteResource(id)
      } catch (error) {
        if (originalResource) {
          set((state) => {
            state.resources.push(originalResource)
            state.allocations.push(...originalAllocations)
            state.tasksWithData = computeTasksWithData(
              state.tasks,
              state.resources,
              state.allocations
            )
            state.error = error instanceof Error ? error.message : 'Fehler beim Löschen'
          })
        }
        throw error
      }
    },
    
    // Allocation CRUD.
    // The tree patch is computed from the *current* (already finalized) state
    // before entering the immer draft: reading the draft would make immer try to
    // proxy the `allocationMap` Maps inside it.
    setAllocation: (resourceId, date, percentage, colorHex) => {
      const state = get()
      const existingIndex = state.allocations.findIndex(
        a => a.resource_id === resourceId && a.date === date
      )
      const existing = existingIndex !== -1 ? state.allocations[existingIndex] : undefined

      const allocation: Allocation = existing
        ? { ...existing, percentage, color_hex: colorHex }
        : {
            // Temporäre ID für optimistic update
            id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            resource_id: resourceId,
            date,
            percentage,
            color_hex: colorHex,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }

      const tasksWithData = patchAllocationInTree(
        state.tasksWithData,
        resourceId,
        date,
        allocation
      )

      set((draft) => {
        if (existingIndex !== -1) draft.allocations[existingIndex] = allocation
        else draft.allocations.push(allocation)
        draft.tasksWithData = tasksWithData
      })
    },
    
    setAllocationAsync: async (resourceId, date, percentage, colorHex) => {
      // Skip if resource is temp
      if (resourceId.startsWith('temp_')) {
        get().setAllocation(resourceId, date, percentage, colorHex)
        return
      }
      
      // Optimistic update
      get().setAllocation(resourceId, date, percentage, colorHex)
      
      try {
        const savedAllocation = await api.upsertAllocation(resourceId, date, percentage, colorHex)
        
        // Update temp ID to real ID
        set((state) => {
          const index = state.allocations.findIndex(
            a => a.resource_id === resourceId && a.date === date
          )
          if (index !== -1) {
            state.allocations[index] = savedAllocation
          }
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Fehler beim Speichern'
        })
        // Note: We don't rollback allocation changes since user may continue painting
      }
    },
    
    removeAllocation: (resourceId, date) => {
      const tasksWithData = patchAllocationInTree(
        get().tasksWithData,
        resourceId,
        date,
        null
      )

      set((draft) => {
        draft.allocations = draft.allocations.filter(
          a => !(a.resource_id === resourceId && a.date === date)
        )
        draft.tasksWithData = tasksWithData
      })
    },
    
    removeAllocationAsync: async (resourceId, date) => {
      if (resourceId.startsWith('temp_')) {
        get().removeAllocation(resourceId, date)
        return
      }
      
      const originalAllocation = get().allocations.find(
        a => a.resource_id === resourceId && a.date === date
      )
      
      get().removeAllocation(resourceId, date)
      
      try {
        await api.deleteAllocationByKey(resourceId, date)
      } catch (error) {
        // Rollback
        if (originalAllocation) {
          set((state) => {
            state.allocations.push(originalAllocation)
            state.tasksWithData = computeTasksWithData(
              state.tasks,
              state.resources,
              state.allocations
            )
            state.error = error instanceof Error ? error.message : 'Fehler beim Löschen'
          })
        }
      }
    },
    
    // ==================== Custom Columns ====================
    getCustomValue: (columnId, rowType, rowId) => {
      const v = get().customValues.find(
        cv => cv.column_id === columnId && cv.row_type === rowType && cv.row_id === rowId
      )
      return v?.value ?? ''
    },

    createCustomColumnAsync: async (projectId, name) => {
      const sortOrder = get().customColumns.length
      const newColumn = await api.createCustomColumn({ project_id: projectId, name, sort_order: sortOrder })
      set((state) => {
        if (!state.customColumns.find(c => c.id === newColumn.id)) {
          state.customColumns.push(newColumn)
        }
        if (state.subscription) {
          state.subscription.updateColumnIds(state.customColumns.map(c => c.id))
        }
      })
      return newColumn
    },

    updateCustomColumnAsync: async (id, patch) => {
      const original = get().customColumns.find(c => c.id === id)
      // Optimistic update (name and/or width)
      set((state) => {
        const idx = state.customColumns.findIndex(c => c.id === id)
        if (idx !== -1) {
          if (patch.name !== undefined) state.customColumns[idx].name = patch.name
          if (patch.width !== undefined) state.customColumns[idx].width = patch.width
        }
      })
      try {
        await api.updateCustomColumn(id, patch)
      } catch (error) {
        if (original) {
          set((state) => {
            const idx = state.customColumns.findIndex(c => c.id === id)
            if (idx !== -1) {
              if (patch.name !== undefined) state.customColumns[idx].name = original.name
              if (patch.width !== undefined) state.customColumns[idx].width = original.width
            }
            state.error = error instanceof Error ? error.message : 'Fehler beim Aktualisieren'
          })
        }
      }
    },

    deleteCustomColumnAsync: async (id) => {
      const originalColumns = get().customColumns
      const originalValues = get().customValues
      // Optimistic remove (column + its values)
      set((state) => {
        state.customColumns = state.customColumns.filter(c => c.id !== id)
        state.customValues = state.customValues.filter(cv => cv.column_id !== id)
        if (state.subscription) {
          state.subscription.updateColumnIds(state.customColumns.map(c => c.id))
        }
      })
      try {
        await api.deleteCustomColumn(id)
      } catch (error) {
        set((state) => {
          state.customColumns = originalColumns
          state.customValues = originalValues
          state.error = error instanceof Error ? error.message : 'Fehler beim Löschen'
        })
      }
    },

    setCustomValueAsync: async (columnId, rowType, rowId, value) => {
      const trimmed = value
      const original = get().customValues.find(
        cv => cv.column_id === columnId && cv.row_type === rowType && cv.row_id === rowId
      )

      // Optimistic update
      set((state) => {
        const idx = state.customValues.findIndex(
          cv => cv.column_id === columnId && cv.row_type === rowType && cv.row_id === rowId
        )
        if (!trimmed || trimmed.trim() === '') {
          if (idx !== -1) state.customValues.splice(idx, 1)
        } else if (idx !== -1) {
          state.customValues[idx].value = trimmed
        } else {
          state.customValues.push({
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            column_id: columnId,
            row_type: rowType,
            row_id: rowId,
            value: trimmed,
          })
        }
      })

      try {
        const saved = await api.upsertCustomValue(columnId, rowType, rowId, trimmed)
        set((state) => {
          const idx = state.customValues.findIndex(
            cv => cv.column_id === columnId && cv.row_type === rowType && cv.row_id === rowId
          )
          if (saved) {
            if (idx !== -1) state.customValues[idx] = saved
            else state.customValues.push(saved)
          } else if (idx !== -1) {
            state.customValues.splice(idx, 1)
          }
        })
      } catch (error) {
        // Rollback
        set((state) => {
          state.customValues = state.customValues.filter(
            cv => !(cv.column_id === columnId && cv.row_type === rowType && cv.row_id === rowId)
          )
          if (original) state.customValues.push(original)
          state.error = error instanceof Error ? error.message : 'Fehler beim Speichern'
        })
      }
    },

    // Realtime event handlers
    handleProjectChange: (event) => {
      if (event.action === 'update') {
        set((state) => {
          state.project = event.record
        })
      }
      // Handle delete - could navigate away or show message
    },

    handleCustomColumnChange: (event) => {
      const { action, record } = event
      set((state) => {
        if (action === 'create') {
          if (!state.customColumns.find(c => c.id === record.id)) {
            state.customColumns.push(record)
          }
        } else if (action === 'update') {
          const idx = state.customColumns.findIndex(c => c.id === record.id)
          if (idx !== -1) state.customColumns[idx] = record
        } else if (action === 'delete') {
          state.customColumns = state.customColumns.filter(c => c.id !== record.id)
          state.customValues = state.customValues.filter(cv => cv.column_id !== record.id)
        }
        state.customColumns.sort((a, b) => a.sort_order - b.sort_order)
        if (state.subscription) {
          state.subscription.updateColumnIds(state.customColumns.map(c => c.id))
        }
      })
    },

    handleCustomValueChange: (event) => {
      const { action, record } = event
      set((state) => {
        if (action === 'create' || action === 'update') {
          // Replace any temp/existing entry for the same (column,row)
          const idx = state.customValues.findIndex(
            cv => cv.id === record.id ||
                  (cv.column_id === record.column_id && cv.row_type === record.row_type && cv.row_id === record.row_id)
          )
          if (idx !== -1) state.customValues[idx] = record
          else state.customValues.push(record)
        } else if (action === 'delete') {
          state.customValues = state.customValues.filter(cv => cv.id !== record.id)
        }
      })
    },
    
    handleTaskChange: (event) => {
      const { action, record } = event
      
      set((state) => {
        if (action === 'create') {
          // Check if already present by ID
          const existingById = state.tasks.find(t => t.id === record.id)
          if (existingById) return // Already have this exact record
          
          // Check for temp record that matches (our own optimistic update).
          // parent_id is part of the match because identical subtask names
          // ("Konzept", "Test") across different parents are common.
          const tempIndex = state.tasks.findIndex(
            t => t.id.startsWith('temp_') && 
                 t.project_id === record.project_id && 
                 t.name === record.name &&
                 (t.parent_id || '') === (record.parent_id || '')
          )
          if (tempIndex !== -1) {
            // Replace temp with real record
            state.tasks[tempIndex] = record
          } else {
            // New record from another client
            state.tasks.push(record)
          }
        } else if (action === 'update') {
          const index = state.tasks.findIndex(t => t.id === record.id)
          if (index !== -1) {
            state.tasks[index] = record
          }
        } else if (action === 'delete') {
          state.tasks = state.tasks.filter(t => t.id !== record.id)
          // Also remove resources and allocations
          const resourceIds = state.resources
            .filter(r => r.task_id === record.id)
            .map(r => r.id)
          state.resources = state.resources.filter(r => r.task_id !== record.id)
          state.allocations = state.allocations.filter(
            a => !resourceIds.includes(a.resource_id)
          )
        }
        
        state.tasksWithData = computeTasksWithData(
          state.tasks,
          state.resources,
          state.allocations
        )
        
        // Update subscription
        if (state.subscription) {
          state.subscription.updateTaskIds(state.tasks.map(t => t.id))
        }
      })
    },
    
    handleResourceChange: (event) => {
      const { action, record } = event
      
      set((state) => {
        if (action === 'create') {
          // Check if already present by ID
          const existingById = state.resources.find(r => r.id === record.id)
          if (existingById) return
          
          // Check for temp record that matches
          const tempIndex = state.resources.findIndex(
            r => r.id.startsWith('temp_') && 
                 r.task_id === record.task_id && 
                 r.name === record.name
          )
          if (tempIndex !== -1) {
            state.resources[tempIndex] = record
          } else {
            state.resources.push(record)
          }
        } else if (action === 'update') {
          const index = state.resources.findIndex(r => r.id === record.id)
          if (index !== -1) {
            state.resources[index] = record
          }
        } else if (action === 'delete') {
          state.resources = state.resources.filter(r => r.id !== record.id)
          state.allocations = state.allocations.filter(a => a.resource_id !== record.id)
        }
        
        state.tasksWithData = computeTasksWithData(
          state.tasks,
          state.resources,
          state.allocations
        )
        
        // Update subscription
        if (state.subscription) {
          state.subscription.updateResourceIds(state.resources.map(r => r.id))
        }
      })
    },
    
    handleAllocationChange: (event) => {
      const { action, record } = event

      // Same reasoning as setAllocation: patch the tree from finalized state
      // before entering the draft. A remote user painting a stroke produces one
      // event per cell, so a full rebuild per event would be as expensive as
      // the local paint path used to be.
      const tasksWithData = patchAllocationInTree(
        get().tasksWithData,
        record.resource_id,
        record.date,
        action === 'delete' ? null : record
      )

      set((state) => {
        if (action === 'create') {
          // Only add if not already present (avoid duplicates from optimistic updates)
          const exists = state.allocations.find(
            a => a.id === record.id || 
                 (a.resource_id === record.resource_id && a.date === record.date)
          )
          if (!exists) {
            state.allocations.push(record)
          } else if (exists.id !== record.id) {
            // Replace temp allocation with real one
            const index = state.allocations.indexOf(exists)
            if (index !== -1) {
              state.allocations[index] = record
            }
          }
        } else if (action === 'update') {
          const index = state.allocations.findIndex(a => a.id === record.id)
          if (index !== -1) {
            state.allocations[index] = record
          } else {
            // Might be updating a temp allocation
            const tempIndex = state.allocations.findIndex(
              a => a.resource_id === record.resource_id && a.date === record.date
            )
            if (tempIndex !== -1) {
              state.allocations[tempIndex] = record
            }
          }
        } else if (action === 'delete') {
          state.allocations = state.allocations.filter(a => a.id !== record.id)
        }

        state.tasksWithData = tasksWithData
      })
    },

    handlePresenceChange: (event) => {
      const { action, record } = event
      const state = get()
      
      // Ignore own presence
      if (record.session_id === state.sessionId) return
      
      set((s) => {
        if (action === 'create') {
          // Check if already present
          const exists = s.presenceList.find(p => p.session_id === record.session_id)
          if (!exists) {
            s.presenceList.push(record)
          }
        } else if (action === 'update') {
          const index = s.presenceList.findIndex(p => p.session_id === record.session_id)
          if (index !== -1) {
            s.presenceList[index] = record
          } else {
            // New user joined
            s.presenceList.push(record)
          }
        } else if (action === 'delete') {
          s.presenceList = s.presenceList.filter(p => p.id !== record.id)
        }
      })
    },
    
    // Subscribe to realtime updates
    subscribeToProject: async (projectId) => {
      const state = get()
      
      // Unsubscribe from previous if exists
      if (state.subscription) {
        await state.subscription.unsubscribeAll()
      }
      
      const taskIds = state.tasks.map(t => t.id)
      const resourceIds = state.resources.map(r => r.id)
      const columnIds = state.customColumns.map(c => c.id)
      
      try {
        const subscription = await api.subscribeToProjectChanges(
          projectId,
          taskIds,
          resourceIds,
          {
            onProjectChange: (e) => get().handleProjectChange(e),
            onTaskChange: (e) => get().handleTaskChange(e),
            onResourceChange: (e) => get().handleResourceChange(e),
            onAllocationChange: (e) => get().handleAllocationChange(e),
            onCustomColumnChange: (e) => get().handleCustomColumnChange(e),
            onCustomValueChange: (e) => get().handleCustomValueChange(e),
          },
          columnIds
        )
        
        set((s) => {
          s.subscription = subscription
        })
      } catch (error) {
        console.error('Failed to subscribe to project changes:', error)
        set((s) => {
          s.error = 'Live-Sync konnte nicht aktiviert werden'
        })
      }
    },
    
    unsubscribeFromProject: async () => {
      const { subscription } = get()
      if (subscription) {
        await subscription.unsubscribeAll()
        set((state) => {
          state.subscription = null
        })
      }
    },
    
    // Presence management
    initializePresence: (realUserName?: string) => {
      const state = get()
      
      // Wenn bereits initialisiert, aber ein echter Name übergeben wird und der aktuelle
      // Name noch ein generierter ist, aktualisiere den Namen
      if (state.sessionId) {
        if (realUserName && state.userName !== realUserName) {
          set((s) => {
            s.userName = realUserName
          })
          // Aktualisiere auch die Presence in der Datenbank sofort
          const { project, sessionId, userColor } = get()
          if (project) {
            api.upsertPresence(project.id, sessionId, realUserName, userColor)
          }
        }
        return
      }
      
      const sessionId = api.generateSessionId()
      // Verwende den echten Namen, falls vorhanden, sonst generiere einen zufälligen
      const userName = realUserName || api.generateUserName()
      const userColor = api.getPresenceColor(sessionId)
      
      set((s) => {
        s.sessionId = sessionId
        s.userName = userName
        s.userColor = userColor
      })
    },
    
    startPresence: async (projectId: string) => {
      const state = get()
      
      // Ensure presence is initialized
      if (!state.sessionId) {
        get().initializePresence()
      }
      
      const { sessionId, userName, userColor } = get()
      
      // Create initial presence record
      await api.upsertPresence(projectId, sessionId, userName, userColor)
      
      // Fetch existing presence
      const presenceList = await api.fetchPresence(projectId)
      set((s) => {
        s.presenceList = presenceList.filter(p => p.session_id !== sessionId)
      })
      
      // Subscribe to presence changes (await for connection)
      const presenceSubscription = await api.subscribeToPresence(projectId, (e) => {
        get().handlePresenceChange(e)
      })
      
      // Start heartbeat interval (every 10 seconds)
      const presenceInterval = setInterval(async () => {
        const { project, sessionId, userName, userColor } = get()
        if (!project) return

        await api.upsertPresence(project.id, sessionId, userName, userColor)

        // Also clean up stale presence locally. Only write when something
        // actually dropped out - otherwise every heartbeat would hand out a new
        // array identity and re-render all presence consumers.
        const thirtySecondsAgo = Date.now() - 30000
        const isFresh = (p: Presence) => new Date(p.last_seen).getTime() > thirtySecondsAgo
        if (get().presenceList.every(isFresh)) return

        set((s) => {
          s.presenceList = s.presenceList.filter(isFresh)
        })
      }, 10000)
      
      set((s) => {
        s.presenceSubscription = presenceSubscription
        s.presenceInterval = presenceInterval
      })
    },
    
    stopPresence: async () => {
      const { sessionId, presenceSubscription, presenceInterval } = get()
      
      // Clear interval
      if (presenceInterval) {
        clearInterval(presenceInterval)
      }
      
      // Unsubscribe
      if (presenceSubscription) {
        await presenceSubscription.unsubscribe()
      }
      
      // Remove presence record
      if (sessionId) {
        await api.removePresence(sessionId)
      }
      
      set((s) => {
        s.presenceList = []
        s.presenceSubscription = null
        s.presenceInterval = null
      })
    },
    
    getOtherUsers: () => {
      const { presenceList, sessionId } = get()
      return presenceList.filter(p => p.session_id !== sessionId)
    },
    
    // Brush
    setActiveBrush: (brush) => set((state) => {
      state.activeBrush = brush
    }),
    
    setIsPainting: (isPainting) => set((state) => {
      state.isPainting = isPainting
    }),
    
    // Recompute
    recomputeAggregations: () => set((state) => {
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
    }),
    
    // UI State
    setIsLoading: (loading) => set((state) => {
      state.isLoading = loading
    }),
    
    setIsSaving: (saving) => set((state) => {
      state.isSaving = saving
    }),
    
    setError: (error) => set((state) => {
      state.error = error
    }),
    
    // Reset
    reset: () => {
      // Stop presence and unsubscribe before reset
      const { subscription, presenceSubscription, presenceInterval, sessionId } = get()
      
      // Clear presence interval
      if (presenceInterval) {
        clearInterval(presenceInterval)
      }
      
      // Unsubscribe from presence
      if (presenceSubscription) {
        presenceSubscription.unsubscribe()
      }
      
      // Remove presence record
      if (sessionId) {
        api.removePresence(sessionId)
      }
      
      // Unsubscribe from project
      if (subscription) {
        subscription.unsubscribeAll()
      }
      
      // Keep session info for reuse, reset permission
      const { sessionId: sid, userName, userColor } = get()
      set({
        ...initialState,
        sessionId: sid,
        userName,
        userColor,
        userPermission: null,
      })
    },
  }))
)

// ==================== Selectors ====================

/**
 * Actions are created once when the store is built and never replaced, so they
 * can be read without subscribing. Components that only dispatch (and never
 * read state) therefore cause zero re-renders.
 *
 * The return type deliberately hides the state fields - reading them here would
 * yield a stale snapshot instead of a reactive value.
 */
export const useProjectActions = (): ProjectActions => useProjectStore.getState()

/** Reactive edit-permission flag (a boolean, so it never re-renders spuriously). */
export const selectCanEdit = (state: ProjectStore): boolean =>
  state.userPermission === 'owner' || state.userPermission === 'edit'

export const useCanEdit = () => useProjectStore(selectCanEdit)
