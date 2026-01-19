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
  DEFAULT_BASE_COLOR,
} from '@/lib/types'
import { computeTaskAggregation, buildAllocationMap } from '@/lib/utils'
import * as api from '@/lib/pocketbase-api'
import type { RecordSubscription } from 'pocketbase'

// ==================== State Types ====================

interface ProjectState {
  // Current project data
  project: Project | null
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  
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

interface ProjectActions {
  // Data loading
  setProject: (project: Project) => void
  setAllData: (data: {
    project: Project
    tasks: Task[]
    resources: Resource[]
    allocations: Allocation[]
    userPermission: 'owner' | 'edit' | 'view' | null
  }) => void
  
  // Permission helpers
  canEdit: () => boolean
  
  // API: Load project with all data
  loadProject: (projectId: string, realUserName?: string) => Promise<void>
  
  // Task CRUD (with API)
  addTask: (task: Task) => void
  createTaskAsync: (projectId: string, displayId: string, name: string) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => void
  updateTaskAsync: (id: string, updates: Partial<Task>) => Promise<void>
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
  
  // Realtime event handlers
  handleProjectChange: (event: RecordSubscription<Project>) => void
  handleTaskChange: (event: RecordSubscription<Task>) => void
  handleResourceChange: (event: RecordSubscription<Resource>) => void
  handleAllocationChange: (event: RecordSubscription<Allocation>) => void
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

type ProjectStore = ProjectState & ProjectActions

// ==================== Initial State ====================

const initialState: ProjectState = {
  project: null,
  tasks: [],
  resources: [],
  allocations: [],
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

function computeTasksWithData(
  tasks: Task[],
  resources: Resource[],
  allocations: Allocation[]
): TaskWithAggregation[] {
  return tasks.map(task => {
    // Finde alle Ressourcen für diese Task
    const taskResources = resources.filter(r => r.task_id === task.id)
    
    // Erweitere Ressourcen mit Allocations
    const resourcesWithAllocations: ResourceWithAllocations[] = taskResources.map(resource => {
      const resourceAllocations = allocations.filter(a => a.resource_id === resource.id)
      return {
        ...resource,
        allocations: resourceAllocations,
        allocationMap: buildAllocationMap(resourceAllocations),
      }
    })
    
    // Berechne Aggregation
    const computed = computeTaskAggregation(resourcesWithAllocations)
    
    return {
      ...task,
      resources: resourcesWithAllocations,
      computed,
    }
  }).sort((a, b) => a.sort_order - b.sort_order)
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
    
    createTaskAsync: async (projectId, displayId, name) => {
      const sortOrder = get().tasks.length + 1
      
      // Optimistic update with temp ID
      const tempId = `temp_${Date.now()}`
      const tempTask: Task = {
        id: tempId,
        project_id: projectId,
        display_id: displayId,
        name,
        sort_order: sortOrder,
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
    
    deleteTask: (id) => set((state) => {
      state.tasks = state.tasks.filter(t => t.id !== id)
      // Auch zugehörige Ressourcen und Allocations löschen
      const resourceIds = state.resources
        .filter(r => r.task_id === id)
        .map(r => r.id)
      state.resources = state.resources.filter(r => r.task_id !== id)
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
      
      const originalTask = get().tasks.find(t => t.id === id)
      const originalResources = get().resources.filter(r => r.task_id === id)
      const resourceIds = originalResources.map(r => r.id)
      const originalAllocations = get().allocations.filter(a => resourceIds.includes(a.resource_id))
      
      // Optimistic delete
      get().deleteTask(id)
      
      try {
        await api.deleteTask(id)
      } catch (error) {
        // Rollback on error
        if (originalTask) {
          set((state) => {
            state.tasks.push(originalTask)
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
    
    // Allocation CRUD
    setAllocation: (resourceId, date, percentage, colorHex) => set((state) => {
      // Prüfe ob bereits eine Allocation existiert
      const existingIndex = state.allocations.findIndex(
        a => a.resource_id === resourceId && a.date === date
      )
      
      if (existingIndex !== -1) {
        // Update existing
        state.allocations[existingIndex].percentage = percentage
        state.allocations[existingIndex].color_hex = colorHex
      } else {
        // Create new (temporäre ID für optimistic update)
        const newAllocation: Allocation = {
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          resource_id: resourceId,
          date,
          percentage,
          color_hex: colorHex,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        }
        state.allocations.push(newAllocation)
      }
      
      // Recompute
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
    }),
    
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
    
    removeAllocation: (resourceId, date) => set((state) => {
      state.allocations = state.allocations.filter(
        a => !(a.resource_id === resourceId && a.date === date)
      )
      state.tasksWithData = computeTasksWithData(
        state.tasks,
        state.resources,
        state.allocations
      )
    }),
    
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
    
    // Realtime event handlers
    handleProjectChange: (event) => {
      if (event.action === 'update') {
        set((state) => {
          state.project = event.record
        })
      }
      // Handle delete - could navigate away or show message
    },
    
    handleTaskChange: (event) => {
      const { action, record } = event
      
      set((state) => {
        if (action === 'create') {
          // Check if already present by ID
          const existingById = state.tasks.find(t => t.id === record.id)
          if (existingById) return // Already have this exact record
          
          // Check for temp record that matches (our own optimistic update)
          const tempIndex = state.tasks.findIndex(
            t => t.id.startsWith('temp_') && 
                 t.project_id === record.project_id && 
                 t.name === record.name
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
        
        state.tasksWithData = computeTasksWithData(
          state.tasks,
          state.resources,
          state.allocations
        )
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
          }
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
        if (project) {
          await api.upsertPresence(project.id, sessionId, userName, userColor)
          
          // Also clean up stale presence locally
          const thirtySecondsAgo = Date.now() - 30000
          set((s) => {
            s.presenceList = s.presenceList.filter(p => {
              const lastSeen = new Date(p.last_seen).getTime()
              return lastSeen > thirtySecondsAgo
            })
          })
        }
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
