import PocketBase, { RecordSubscription } from 'pocketbase'
import { getPocketBase, clearAuthCookie } from './pocketbase'
import type {
  Project,
  Task,
  Resource,
  Allocation,
  Presence,
  CreateProjectDTO,
  CreateTaskDTO,
  CreateResourceDTO,
  CreateAllocationDTO,
  UpdateAllocationDTO,
  User,
  ProjectPermission,
  LoginCredentials,
  CreateUserDTO,
  UpdateUserDTO,
  CreatePermissionDTO,
  UpdatePermissionDTO,
} from './types'
import { PRESENCE_COLORS } from './types'

// ==================== Projects API ====================

// Project with owner info (manually joined since user_id is text, not relation)
export interface ProjectWithOwner extends Project {
  ownerName?: string
  ownerEmail?: string
}

/**
 * Fetch all projects the current user has access to.
 * Access is granted if:
 * 1. User is the owner (user_id matches)
 * 2. User has a permission entry in project_permissions (view or edit)
 */
export async function fetchProjects(): Promise<ProjectWithOwner[]> {
  const pb = getPocketBase()
  const currentUser = getCurrentUser()
  
  if (!currentUser) {
    return []
  }
  
  // Fetch all projects (API rules already require auth)
  const allProjects = await pb.collection('projects').getFullList<Project>()
  
  // Fetch user's permissions
  const userPermissions = await pb.collection('project_permissions').getFullList<ProjectPermission>({
    filter: `user_id = "${currentUser.id}"`,
  })
  
  // Create set of project IDs user has permissions for
  const permittedProjectIds = new Set(userPermissions.map(p => p.project_id))
  
  // Filter: user is owner OR has permission
  const accessibleProjects = allProjects.filter(project => 
    project.user_id === currentUser.id || permittedProjectIds.has(project.id)
  )
  
  // Collect unique user IDs to fetch owner info
  const ownerIds = [...new Set(accessibleProjects.map(p => p.user_id).filter(Boolean))]
  
  // Fetch all owners in one request
  const ownerMap = new Map<string, User>()
  if (ownerIds.length > 0) {
    try {
      const owners = await pb.collection('users').getFullList<User>({
        filter: ownerIds.map(id => `id = "${id}"`).join(' || '),
      })
      owners.forEach(owner => ownerMap.set(owner.id, owner))
    } catch (err) {
      console.warn('Could not fetch project owners:', err)
    }
  }
  
  // Merge owner info into projects
  const projectsWithOwners: ProjectWithOwner[] = accessibleProjects.map(project => {
    const owner = ownerMap.get(project.user_id)
    return {
      ...project,
      ownerName: owner?.name,
      ownerEmail: owner?.email,
    }
  })
  
  return projectsWithOwners
}

export async function fetchProject(id: string): Promise<Project> {
  const pb = getPocketBase()
  return await pb.collection('projects').getOne<Project>(id)
}

export async function createProject(data: CreateProjectDTO): Promise<Project> {
  const pb = getPocketBase()
  // Note: user_id should be set server-side via API rules, or passed here if auth is implemented
  return await pb.collection('projects').create<Project>({
    ...data,
    user_id: pb.authStore.model?.id || 'anonymous',
  })
}

export async function updateProject(id: string, data: Partial<CreateProjectDTO>): Promise<Project> {
  const pb = getPocketBase()
  return await pb.collection('projects').update<Project>(id, data)
}

export async function deleteProject(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('projects').delete(id)
}

// ==================== Tasks API ====================

export async function fetchTasks(projectId: string): Promise<Task[]> {
  const pb = getPocketBase()
  return await pb.collection('tasks').getFullList<Task>({
    filter: `project_id = "${projectId}"`,
    sort: 'sort_order',
  })
}

export async function createTask(data: CreateTaskDTO): Promise<Task> {
  const pb = getPocketBase()
  return await pb.collection('tasks').create<Task>(data)
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const pb = getPocketBase()
  return await pb.collection('tasks').update<Task>(id, data)
}

export async function deleteTask(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('tasks').delete(id)
}

// ==================== Resources API ====================

export async function fetchResources(taskIds: string[]): Promise<Resource[]> {
  if (taskIds.length === 0) return []
  
  const pb = getPocketBase()
  const filter = taskIds.map(id => `task_id = "${id}"`).join(' || ')
  return await pb.collection('resources').getFullList<Resource>({
    filter,
    sort: 'sort_order',
  })
}

export async function fetchResourcesByProject(projectId: string): Promise<Resource[]> {
  const pb = getPocketBase()
  // First get all tasks for this project
  const tasks = await fetchTasks(projectId)
  if (tasks.length === 0) return []
  return fetchResources(tasks.map(t => t.id))
}

export async function createResource(data: CreateResourceDTO): Promise<Resource> {
  const pb = getPocketBase()
  return await pb.collection('resources').create<Resource>(data)
}

export async function updateResource(id: string, data: Partial<Resource>): Promise<Resource> {
  const pb = getPocketBase()
  return await pb.collection('resources').update<Resource>(id, data)
}

export async function deleteResource(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('resources').delete(id)
}

// ==================== Allocations API ====================

export async function fetchAllocations(resourceIds: string[]): Promise<Allocation[]> {
  if (resourceIds.length === 0) return []
  
  const pb = getPocketBase()
  const filter = resourceIds.map(id => `resource_id = "${id}"`).join(' || ')
  return await pb.collection('allocations').getFullList<Allocation>({
    filter,
    sort: 'date',
  })
}

export async function fetchAllocationsByProject(projectId: string): Promise<Allocation[]> {
  const pb = getPocketBase()
  // Get all resources for this project's tasks
  const resources = await fetchResourcesByProject(projectId)
  if (resources.length === 0) return []
  return fetchAllocations(resources.map(r => r.id))
}

export async function createAllocation(data: CreateAllocationDTO): Promise<Allocation> {
  const pb = getPocketBase()
  return await pb.collection('allocations').create<Allocation>(data)
}

export async function updateAllocation(id: string, data: UpdateAllocationDTO): Promise<Allocation> {
  const pb = getPocketBase()
  return await pb.collection('allocations').update<Allocation>(id, data)
}

export async function deleteAllocation(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('allocations').delete(id)
}

// Upsert: Create or update allocation by resource_id + date
export async function upsertAllocation(
  resourceId: string, 
  date: string, 
  percentage: number, 
  colorHex: string
): Promise<Allocation> {
  const pb = getPocketBase()
  
  // Check if allocation exists
  try {
    const existing = await pb.collection('allocations').getFirstListItem<Allocation>(
      `resource_id = "${resourceId}" && date = "${date}"`
    )
    // Update existing
    return await pb.collection('allocations').update<Allocation>(existing.id, {
      percentage,
      color_hex: colorHex,
    })
  } catch {
    // Create new
    return await pb.collection('allocations').create<Allocation>({
      resource_id: resourceId,
      date,
      percentage,
      color_hex: colorHex,
    })
  }
}

// Delete allocation by resource_id + date
export async function deleteAllocationByKey(resourceId: string, date: string): Promise<boolean> {
  const pb = getPocketBase()
  
  try {
    const existing = await pb.collection('allocations').getFirstListItem<Allocation>(
      `resource_id = "${resourceId}" && date = "${date}"`
    )
    return await pb.collection('allocations').delete(existing.id)
  } catch {
    return false
  }
}

// ==================== Full Project Data Fetch ====================

export interface ProjectFullData {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  userPermission: 'owner' | 'edit' | 'view' | null
}

/**
 * Fetch complete project data with all tasks, resources, and allocations.
 * Includes permission check - throws error if user doesn't have access.
 */
export async function fetchProjectFullData(projectId: string): Promise<ProjectFullData> {
  const pb = getPocketBase()
  const currentUser = getCurrentUser()
  
  if (!currentUser) {
    throw new Error('Nicht authentifiziert')
  }
  
  // Fetch project
  const project = await pb.collection('projects').getOne<Project>(projectId)
  
  // Check user's permission level
  let userPermission: 'owner' | 'edit' | 'view' | null = null
  
  // Check if user is owner
  if (project.user_id === currentUser.id) {
    userPermission = 'owner'
  } else {
    // Check for explicit permission
    try {
      const permission = await pb.collection('project_permissions').getFirstListItem<ProjectPermission>(
        `user_id = "${currentUser.id}" && project_id = "${projectId}"`
      )
      userPermission = permission.permission_level as 'edit' | 'view'
    } catch {
      // No permission found
      userPermission = null
    }
  }
  
  // If no permission, throw error
  if (!userPermission) {
    throw new Error('Keine Berechtigung für dieses Projekt. Bitte den Projektbesitzer um Freigabe bitten.')
  }
  
  // Fetch tasks
  const tasks = await pb.collection('tasks').getFullList<Task>({
    filter: `project_id = "${projectId}"`,
    sort: 'sort_order',
  })
  
  // Fetch resources for all tasks
  let resources: Resource[] = []
  if (tasks.length > 0) {
    const taskFilter = tasks.map(t => `task_id = "${t.id}"`).join(' || ')
    resources = await pb.collection('resources').getFullList<Resource>({
      filter: taskFilter,
      sort: 'sort_order',
    })
  }
  
  // Fetch allocations for all resources
  let allocations: Allocation[] = []
  if (resources.length > 0) {
    const resourceFilter = resources.map(r => `resource_id = "${r.id}"`).join(' || ')
    allocations = await pb.collection('allocations').getFullList<Allocation>({
      filter: resourceFilter,
      sort: 'date',
    })
  }
  
  return { project, tasks, resources, allocations, userPermission }
}

// ==================== Realtime Subscriptions ====================

export type RealtimeCallback<T> = (event: RecordSubscription<T>) => void

export interface RealtimeUnsubscribe {
  unsubscribe: () => Promise<void>
}

// Subscribe to project updates
export function subscribeToProject(
  projectId: string,
  callback: RealtimeCallback<Project>
): RealtimeUnsubscribe {
  const pb = getPocketBase()
  pb.collection('projects').subscribe<Project>(projectId, callback)
  
  return {
    unsubscribe: async () => {
      try {
        await pb.collection('projects').unsubscribe(projectId)
      } catch { /* ignore */ }
    }
  }
}

// Subscribe to all tasks of a project
export function subscribeToTasks(
  projectId: string,
  callback: RealtimeCallback<Task>
): RealtimeUnsubscribe {
  const pb = getPocketBase()
  
  // Subscribe to collection-level changes with filter
  // Note: PocketBase subscriptions don't support filters directly,
  // so we subscribe to all and filter in callback
  pb.collection('tasks').subscribe<Task>('*', (e) => {
    if (e.record.project_id === projectId) {
      callback(e)
    }
  })
  
  return {
    unsubscribe: async () => {
      try {
        await pb.collection('tasks').unsubscribe('*')
      } catch { /* ignore */ }
    }
  }
}

// Subscribe to all resources of a project's tasks
export function subscribeToResources(
  taskIds: string[],
  callback: RealtimeCallback<Resource>
): RealtimeUnsubscribe {
  const pb = getPocketBase()
  const taskIdSet = new Set(taskIds)
  
  pb.collection('resources').subscribe<Resource>('*', (e) => {
    if (taskIdSet.has(e.record.task_id)) {
      callback(e)
    }
  })
  
  return {
    unsubscribe: async () => {
      try {
        await pb.collection('resources').unsubscribe('*')
      } catch { /* ignore */ }
    }
  }
}

// Subscribe to all allocations of a project's resources
export function subscribeToAllocations(
  resourceIds: string[],
  callback: RealtimeCallback<Allocation>
): RealtimeUnsubscribe {
  const pb = getPocketBase()
  const resourceIdSet = new Set(resourceIds)
  
  pb.collection('allocations').subscribe<Allocation>('*', (e) => {
    if (resourceIdSet.has(e.record.resource_id)) {
      callback(e)
    }
  })
  
  return {
    unsubscribe: async () => {
      try {
        await pb.collection('allocations').unsubscribe('*')
      } catch { /* ignore */ }
    }
  }
}

// ==================== Unified Project Subscription ====================

export interface ProjectSubscription {
  unsubscribeAll: () => Promise<void>
  updateResourceIds: (resourceIds: string[]) => void
  updateTaskIds: (taskIds: string[]) => void
  isReady: () => boolean
}

export async function subscribeToProjectChanges(
  projectId: string,
  initialTaskIds: string[],
  initialResourceIds: string[],
  callbacks: {
    onProjectChange: RealtimeCallback<Project>
    onTaskChange: RealtimeCallback<Task>
    onResourceChange: RealtimeCallback<Resource>
    onAllocationChange: RealtimeCallback<Allocation>
  }
): Promise<ProjectSubscription> {
  const pb = getPocketBase()
  
  let taskIds = new Set(initialTaskIds)
  let resourceIds = new Set(initialResourceIds)
  let ready = false
  
  // Queue for events that arrived before we could verify their parent exists
  const pendingResources: Array<RecordSubscription<Resource>> = []
  const pendingAllocations: Array<RecordSubscription<Allocation>> = []
  
  // Process pending resources after task IDs are updated
  const processPendingResources = () => {
    const toProcess = [...pendingResources]
    pendingResources.length = 0
    
    for (const e of toProcess) {
      if (taskIds.has(e.record.task_id)) {
        callbacks.onResourceChange(e)
        if (e.action === 'create') {
          resourceIds.add(e.record.id)
        } else if (e.action === 'delete') {
          resourceIds.delete(e.record.id)
        }
      }
    }
  }
  
  // Process pending allocations after resource IDs are updated
  const processPendingAllocations = () => {
    const toProcess = [...pendingAllocations]
    pendingAllocations.length = 0
    
    for (const e of toProcess) {
      if (resourceIds.has(e.record.resource_id)) {
        callbacks.onAllocationChange(e)
      }
    }
  }
  
  try {
    // Subscribe to project - await for connection
    await pb.collection('projects').subscribe<Project>(projectId, callbacks.onProjectChange)
    
    // Subscribe to tasks
    await pb.collection('tasks').subscribe<Task>('*', (e) => {
      if (e.record.project_id === projectId) {
        callbacks.onTaskChange(e)
        // Update taskIds set when tasks are created/deleted
        if (e.action === 'create') {
          taskIds.add(e.record.id)
          // Process any pending resources that might belong to this task
          processPendingResources()
        } else if (e.action === 'delete') {
          taskIds.delete(e.record.id)
        }
      }
    })
    
    // Subscribe to resources
    await pb.collection('resources').subscribe<Resource>('*', (e) => {
      if (taskIds.has(e.record.task_id)) {
        callbacks.onResourceChange(e)
        // Update resourceIds set when resources are created/deleted
        if (e.action === 'create') {
          resourceIds.add(e.record.id)
          // Process any pending allocations that might belong to this resource
          processPendingAllocations()
        } else if (e.action === 'delete') {
          resourceIds.delete(e.record.id)
        }
      } else if (e.action === 'create') {
        // Task ID not known yet - queue for later processing
        pendingResources.push(e)
        // Try again after a short delay (task event might be in flight)
        setTimeout(processPendingResources, 100)
      }
    })
    
    // Subscribe to allocations
    await pb.collection('allocations').subscribe<Allocation>('*', (e) => {
      if (resourceIds.has(e.record.resource_id)) {
        callbacks.onAllocationChange(e)
      } else if (e.action === 'create' || e.action === 'update') {
        // Resource ID not known yet - queue for later processing
        pendingAllocations.push(e)
        // Try again after a short delay (resource event might be in flight)
        setTimeout(processPendingAllocations, 100)
      }
    })
    
    ready = true
    console.log('[PocketBase] Realtime subscriptions established for project:', projectId)
    
  } catch (error) {
    console.error('[PocketBase] Failed to establish subscriptions:', error)
    throw error
  }
  
  return {
    unsubscribeAll: async () => {
      ready = false
      // Unsubscribe silently - ignore errors if already unsubscribed or connection closed
      try {
        await pb.collection('projects').unsubscribe(projectId)
      } catch { /* ignore */ }
      try {
        await pb.collection('tasks').unsubscribe('*')
      } catch { /* ignore */ }
      try {
        await pb.collection('resources').unsubscribe('*')
      } catch { /* ignore */ }
      try {
        await pb.collection('allocations').unsubscribe('*')
      } catch { /* ignore */ }
    },
    updateResourceIds: (newResourceIds: string[]) => {
      resourceIds = new Set(newResourceIds)
      processPendingAllocations()
    },
    updateTaskIds: (newTaskIds: string[]) => {
      taskIds = new Set(newTaskIds)
      processPendingResources()
    },
    isReady: () => ready,
  }
}

// ==================== Presence API ====================

// Generate a unique session ID
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get a random presence color based on session ID
export function getPresenceColor(sessionId: string): string {
  const hash = sessionId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

// Generate a random user name
export function generateUserName(): string {
  const adjectives = ['Fleißig', 'Kreativ', 'Schnell', 'Clever', 'Fokussiert', 'Motiviert']
  const nouns = ['Planer', 'Manager', 'Stratege', 'Denker', 'Macher', 'Team']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj}er ${noun}`
}

// Fetch active presence records for a project
export async function fetchPresence(projectId: string): Promise<Presence[]> {
  const pb = getPocketBase()
  
  // Get presence records updated in the last 30 seconds
  const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
  
  try {
    return await pb.collection('presence').getFullList<Presence>({
      filter: `project_id = "${projectId}" && last_seen >= "${thirtySecondsAgo}"`,
      sort: '-last_seen',
    })
  } catch {
    return []
  }
}

// Create or update presence
export async function upsertPresence(
  projectId: string,
  sessionId: string,
  userName: string,
  userColor: string
): Promise<Presence | null> {
  const pb = getPocketBase()
  
  try {
    // Try to find existing presence by session_id
    const existing = await pb.collection('presence').getFirstListItem<Presence>(
      `session_id = "${sessionId}"`
    ).catch(() => null)
    
    if (existing) {
      // Update last_seen
      return await pb.collection('presence').update<Presence>(existing.id, {
        last_seen: new Date().toISOString(),
        project_id: projectId,
      })
    } else {
      // Create new presence
      return await pb.collection('presence').create<Presence>({
        project_id: projectId,
        session_id: sessionId,
        user_name: userName,
        user_color: userColor,
        last_seen: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Failed to upsert presence:', error)
    return null
  }
}

// Remove presence when leaving
export async function removePresence(sessionId: string): Promise<void> {
  const pb = getPocketBase()
  
  try {
    const existing = await pb.collection('presence').getFirstListItem<Presence>(
      `session_id = "${sessionId}"`
    )
    if (existing) {
      await pb.collection('presence').delete(existing.id)
    }
  } catch {
    // Ignore errors
  }
}

// Subscribe to presence changes for a project
export async function subscribeToPresence(
  projectId: string,
  callback: RealtimeCallback<Presence>
): Promise<RealtimeUnsubscribe> {
  const pb = getPocketBase()
  
  await pb.collection('presence').subscribe<Presence>('*', (e) => {
    if (e.record.project_id === projectId) {
      callback(e)
    }
  })
  
  console.log('[PocketBase] Presence subscription established for project:', projectId)
  
  return {
    unsubscribe: async () => {
      try {
        await pb.collection('presence').unsubscribe('*')
      } catch { /* ignore */ }
    }
  }
}

// ==================== Authentication API ====================

// Login with email/password
export async function login(credentials: LoginCredentials): Promise<User> {
  const pb = getPocketBase()
  const authData = await pb.collection('users').authWithPassword(
    credentials.email,
    credentials.password
  )
  
  // Login successful - mark setup as complete (users exist!)
  markSetupComplete()
  
  const user = authData.record as unknown as User
  
  // Check if this user is the first admin (fallback if isAdmin field doesn't exist)
  const firstAdminId = getFirstAdminId()
  if (firstAdminId && user.id === firstAdminId && !user.isAdmin) {
    return { ...user, isAdmin: true }
  }
  
  return user
}

// Logout - clear auth store, cookie, and reset flags
export function logout(): void {
  const pb = getPocketBase()
  pb.authStore.clear()
  clearAuthCookie()
  resetPromotionFlag()
}

// Get current authenticated user
export function getCurrentUser(): User | null {
  const pb = getPocketBase()
  if (!pb.authStore.isValid || !pb.authStore.model) {
    return null
  }
  
  const user = pb.authStore.model as unknown as User
  
  // Check if this user is the first admin (fallback if isAdmin field doesn't exist)
  const firstAdminId = getFirstAdminId()
  if (firstAdminId && user.id === firstAdminId && !user.isAdmin) {
    return { ...user, isAdmin: true }
  }
  
  return user
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const pb = getPocketBase()
  return pb.authStore.isValid
}

// Check if current user is admin
export function isAdmin(): boolean {
  const user = getCurrentUser()
  if (!user) return false
  
  // Check database field first
  if (user.isAdmin) return true
  
  // Fallback: check if this is the first admin stored in localStorage
  const firstAdminId = getFirstAdminId()
  return firstAdminId === user.id
}

// Refresh auth token
export async function refreshAuth(): Promise<User | null> {
  const pb = getPocketBase()
  if (!pb.authStore.isValid) {
    return null
  }
  
  try {
    const authData = await pb.collection('users').authRefresh()
    const user = authData.record as unknown as User
    
    // Check if this user is the first admin (fallback if isAdmin field doesn't exist)
    const firstAdminId = getFirstAdminId()
    if (firstAdminId && user.id === firstAdminId && !user.isAdmin) {
      return { ...user, isAdmin: true }
    }
    
    return user
  } catch {
    pb.authStore.clear()
    return null
  }
}

// Register callback for auth state changes
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const pb = getPocketBase()
  
  const unsubscribe = pb.authStore.onChange((token, model) => {
    callback(model as unknown as User | null)
  })
  
  return unsubscribe
}

// ==================== User Management API ====================

// Storage key for setup status
const SETUP_COMPLETE_KEY = 'tinyplanvas_setup_complete'

// Check if initial setup has been completed (uses localStorage as fallback)
export function isSetupComplete(): boolean {
  if (typeof window === 'undefined') return true
  const value = localStorage.getItem(SETUP_COMPLETE_KEY)
  console.log('[Setup] isSetupComplete localStorage value:', value)
  return value === 'true'
}

// Mark setup as complete
export function markSetupComplete(): void {
  if (typeof window === 'undefined') return
  console.log('[Setup] Marking setup as complete')
  localStorage.setItem(SETUP_COMPLETE_KEY, 'true')
}

// Clear setup status (for fresh start)
export function clearSetupStatus(): void {
  if (typeof window === 'undefined') return
  console.log('[Setup] Clearing setup status')
  localStorage.removeItem(SETUP_COMPLETE_KEY)
}

// Check if any users exist (with proper server-side check)
export async function hasUsers(): Promise<boolean> {
  const pb = getPocketBase()
  
  console.log('[Setup] Checking if users exist...')
  
  // PRIORITY 1: If authenticated, we know users exist
  if (pb.authStore.isValid) {
    console.log('[Setup] User is authenticated - users definitely exist')
    markSetupComplete()
    return true
  }
  
  // PRIORITY 2: Check app_status collection (publicly readable - SERVER IS SOURCE OF TRUTH)
  // This is the most reliable method as it doesn't require authentication
  try {
    console.log('[Setup] Checking app_status collection...')
    const statusRecords = await pb.collection('app_status').getList(1, 1, {
      filter: 'key = "setup_complete"'
    })
    
    if (statusRecords.totalItems > 0) {
      const record = statusRecords.items[0]
      if (record.initialized === true || record.value === 'true') {
        console.log('[Setup] app_status indicates setup is complete')
        markSetupComplete()
        return true
      }
    }
    
    // app_status exists but says NOT initialized → No users, show setup
    console.log('[Setup] app_status: no setup_complete record found or not initialized')
    // Clear any stale localStorage to stay in sync with server
    clearSetupStatus()
    return false
  } catch (error) {
    const err = error as { status?: number; message?: string }
    console.log('[Setup] app_status check failed:', { status: err.status, message: err.message })
    
    // If 404, the collection might not exist yet (very fresh install)
    // Continue to other checks
    if (err.status === 404) {
      console.log('[Setup] app_status collection does not exist yet')
    }
  }
  
  // PRIORITY 3: Try to get user count directly
  // This requires authentication with new rules, so likely fails for logged out users
  try {
    const result = await pb.collection('users').getList(1, 1)
    console.log('[Setup] Direct user count:', result.totalItems)
    
    if (result.totalItems > 0) {
      markSetupComplete()
      return true
    }
    console.log('[Setup] No users found on server')
    clearSetupStatus() // Clear stale localStorage
    return false
  } catch (error2) {
    const err = error2 as { status?: number; message?: string }
    console.log('[Setup] Direct count failed:', { status: err.status, message: err.message })
    
    // 403/401 means the collection exists and requires auth
    // We can't tell if users exist, so fall back to localStorage as last resort
    if (err.status === 403 || err.status === 401) {
      console.log('[Setup] Users collection requires auth - using localStorage as fallback')
      // Only use localStorage if server checks are inconclusive
      if (isSetupComplete()) {
        console.log('[Setup] localStorage says setup complete - trusting it as fallback')
        return true
      }
    }
  }
  
  // If all methods fail and we can't determine, show setup screen
  // This is the safest default for a fresh installation
  console.log('[Setup] Could not determine if users exist - assuming no users (showing setup)')
  return false
}

// Storage for first admin user ID (fallback if isAdmin field doesn't exist)
const FIRST_ADMIN_ID_KEY = 'tinyplanvas_first_admin_id'

export function getFirstAdminId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(FIRST_ADMIN_ID_KEY)
}

export function setFirstAdminId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FIRST_ADMIN_ID_KEY, id)
}

// Helper: Set app_status to indicate setup is complete
async function setAppStatusComplete(): Promise<void> {
  const pb = getPocketBase()
  
  try {
    // Check if record already exists
    const existing = await pb.collection('app_status').getList(1, 1, {
      filter: 'key = "setup_complete"'
    })
    
    if (existing.totalItems > 0) {
      // Update existing record
      await pb.collection('app_status').update(existing.items[0].id, {
        initialized: true,
        value: 'true'
      })
      console.log('[Setup] Updated app_status: setup_complete = true')
    } else {
      // Create new record
      await pb.collection('app_status').create({
        key: 'setup_complete',
        initialized: true,
        value: 'true'
      })
      console.log('[Setup] Created app_status: setup_complete = true')
    }
  } catch (error) {
    console.warn('[Setup] Could not set app_status (collection might not exist):', error)
    // This is not critical - localStorage will still work as fallback
  }
}

// Create the first admin user (with race condition protection)
export async function createFirstAdmin(data: {
  name: string
  email: string
  password: string
  passwordConfirm: string
}): Promise<User> {
  const pb = getPocketBase()
  
  console.log('[Setup] Creating first admin user...')
  console.log('[Setup] Email:', data.email)
  console.log('[Setup] Name:', data.name)
  console.log('[Setup] Password length:', data.password.length)
  
  // CRITICAL: First check if users already exist (race condition protection)
  try {
    const existingUsers = await pb.collection('users').getList(1, 1)
    if (existingUsers.totalItems > 0) {
      console.log('[Setup] Users already exist! Attempting login instead...')
      
      // Try to login with the provided credentials
      try {
        const authData = await pb.collection('users').authWithPassword(data.email, data.password)
        const user = authData.record as unknown as User
        console.log('[Setup] Login successful for existing user')
        markSetupComplete()
        await setAppStatusComplete()
        return user
      } catch (loginError) {
        console.error('[Setup] Login failed for existing user:', loginError)
        throw new Error('Ein Benutzer existiert bereits. Bitte nutze den Login.')
      }
    }
  } catch (checkError) {
    // If we can't check, we'll try to create and handle errors
    console.log('[Setup] Could not check for existing users, proceeding with create...')
  }
  
  try {
    // Step 1: Create the user with minimal required fields
    const createData: Record<string, unknown> = {
      email: data.email,
      password: data.password,
      passwordConfirm: data.passwordConfirm,
    }
    
    console.log('[Setup] Creating user with data:', { email: data.email, passwordLength: data.password.length })
    
    const newUser = await pb.collection('users').create<User>(createData)
    
    console.log('[Setup] User created successfully:', newUser.id)
    
    // Step 2: Login with the new user
    console.log('[Setup] Attempting login...')
    await pb.collection('users').authWithPassword(data.email, data.password)
    
    console.log('[Setup] Logged in successfully')
    
    // Step 3: Set app_status to indicate setup is complete
    await setAppStatusComplete()
    
    // Step 4: Try to update with additional fields (name, isAdmin)
    // These might fail if fields don't exist in schema - that's OK
    try {
      const updateData: Record<string, unknown> = {}
      
      if (data.name) {
        updateData.name = data.name
      }
      updateData.isAdmin = true
      
      console.log('[Setup] Attempting to update user with:', updateData)
      const updatedUser = await pb.collection('users').update<User>(newUser.id, updateData)
      console.log('[Setup] User updated successfully')
      
      await pb.collection('users').authRefresh()
      
      // Store this user as the first admin
      setFirstAdminId(updatedUser.id)
      markSetupComplete()
      
      return updatedUser
    } catch (updateError) {
      console.warn('[Setup] Could not update user fields (schema might not have them):', updateError)
      
      // Still save as first admin - we'll use localStorage to track admin status
      setFirstAdminId(newUser.id)
      markSetupComplete()
      
      // Return the user with isAdmin set to true locally
      return { ...newUser, isAdmin: true }
    }
  } catch (error: unknown) {
    console.error('[Setup] Error creating user:', error)
    
    const pbError = error as { 
      status?: number
      message?: string
      response?: { 
        message?: string
        data?: Record<string, { code: string; message: string }> 
      }
    }
    
    console.error('[Setup] Error status:', pbError.status)
    console.error('[Setup] Error message:', pbError.message)
    console.error('[Setup] Error response:', JSON.stringify(pbError.response, null, 2))
    
    // Check if it's a duplicate email error
    if (pbError.response?.data?.email) {
      throw new Error('Diese E-Mail-Adresse wird bereits verwendet. Bitte nutze den Login.')
    }
    
    throw error
  }
}

// Track if we've already attempted promotion in this session
let promotionAttempted = false

// Promote current user to admin if they are the only user
export async function promoteToAdminIfOnlyUser(): Promise<boolean> {
  const pb = getPocketBase()
  
  // Prevent multiple promotion attempts in the same session
  if (promotionAttempted) {
    console.log('[Auth] Promotion already attempted in this session, skipping')
    return false
  }
  
  if (!pb.authStore.isValid || !pb.authStore.model) {
    return false
  }
  
  const currentUser = pb.authStore.model as unknown as User
  
  // Already admin? Nothing to do
  if (currentUser.isAdmin) {
    promotionAttempted = true
    return false
  }
  
  // Check if this user is already marked as first admin in localStorage
  const firstAdminId = getFirstAdminId()
  if (firstAdminId === currentUser.id) {
    console.log('[Auth] User is first admin (localStorage), marking as admin locally')
    promotionAttempted = true
    return false
  }
  
  try {
    promotionAttempted = true
    
    // Try to get user count - this might fail if not admin
    // But we can check if we're the only user by trying to list
    const result = await pb.collection('users').getList(1, 2)
    
    // Only promote if this is the only user
    if (result.totalItems === 1) {
      console.log('[Auth] Only user detected, promoting to admin...')
      await pb.collection('users').update(currentUser.id, { isAdmin: true })
      
      // Store as first admin
      setFirstAdminId(currentUser.id)
      
      // Refresh auth to get updated user data
      await pb.collection('users').authRefresh()
      console.log('[Auth] User promoted to admin')
      return true
    }
    
    return false
  } catch (error) {
    console.error('[Auth] Failed to check/promote admin status:', error)
    return false
  }
}

// Reset promotion flag (call on logout)
export function resetPromotionFlag(): void {
  promotionAttempted = false
}

// Reset setup status (for debugging)
export function resetSetupStatus(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SETUP_COMPLETE_KEY)
}

// Reset app_status in database (for debugging/fresh start)
export async function resetAppStatus(): Promise<void> {
  const pb = getPocketBase()
  
  try {
    const existing = await pb.collection('app_status').getList(1, 1, {
      filter: 'key = "setup_complete"'
    })
    
    if (existing.totalItems > 0) {
      await pb.collection('app_status').delete(existing.items[0].id)
      console.log('[Setup] Deleted app_status: setup_complete')
    }
  } catch (error) {
    console.warn('[Setup] Could not reset app_status:', error)
  }
  
  // Also clear localStorage
  resetSetupStatus()
}

// Fetch all users
export async function fetchUsers(): Promise<User[]> {
  const pb = getPocketBase()
  return await pb.collection('users').getFullList<User>({
    sort: 'name',
  })
}

// Fetch single user
export async function fetchUser(id: string): Promise<User> {
  const pb = getPocketBase()
  return await pb.collection('users').getOne<User>(id)
}

// Create new user (admin)
export async function createUser(data: CreateUserDTO): Promise<User> {
  const pb = getPocketBase()
  return await pb.collection('users').create<User>({
    ...data,
    emailVisibility: true,
  })
}

// Update user
export async function updateUser(id: string, data: UpdateUserDTO): Promise<User> {
  const pb = getPocketBase()
  return await pb.collection('users').update<User>(id, data)
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('users').delete(id)
}

// Toggle admin status
export async function setUserAdmin(id: string, isAdmin: boolean): Promise<User> {
  const pb = getPocketBase()
  return await pb.collection('users').update<User>(id, { isAdmin })
}

// ==================== Project Permissions API ====================

// Fetch permissions for a project
export async function fetchProjectPermissions(projectId: string): Promise<ProjectPermission[]> {
  const pb = getPocketBase()
  return await pb.collection('project_permissions').getFullList<ProjectPermission>({
    filter: `project_id = "${projectId}"`,
    expand: 'user_id',
  })
}

// Fetch permissions for a user
export async function fetchUserPermissions(userId: string): Promise<ProjectPermission[]> {
  const pb = getPocketBase()
  return await pb.collection('project_permissions').getFullList<ProjectPermission>({
    filter: `user_id = "${userId}"`,
    expand: 'project_id',
  })
}

// Check if user has permission for a project
export async function checkProjectPermission(
  userId: string, 
  projectId: string
): Promise<ProjectPermission | null> {
  const pb = getPocketBase()
  try {
    return await pb.collection('project_permissions').getFirstListItem<ProjectPermission>(
      `user_id = "${userId}" && project_id = "${projectId}"`
    )
  } catch {
    return null
  }
}

// Create permission (grant access)
export async function createPermission(data: CreatePermissionDTO): Promise<ProjectPermission> {
  const pb = getPocketBase()
  return await pb.collection('project_permissions').create<ProjectPermission>(data)
}

// Update permission level
export async function updatePermission(
  id: string, 
  data: UpdatePermissionDTO
): Promise<ProjectPermission> {
  const pb = getPocketBase()
  return await pb.collection('project_permissions').update<ProjectPermission>(id, data)
}

// Delete permission (revoke access)
export async function deletePermission(id: string): Promise<boolean> {
  const pb = getPocketBase()
  return await pb.collection('project_permissions').delete(id)
}

// Upsert permission (create or update)
export async function upsertPermission(
  userId: string,
  projectId: string,
  permissionLevel: 'view' | 'edit'
): Promise<ProjectPermission> {
  const pb = getPocketBase()
  
  try {
    const existing = await pb.collection('project_permissions').getFirstListItem<ProjectPermission>(
      `user_id = "${userId}" && project_id = "${projectId}"`
    )
    // Update existing
    return await pb.collection('project_permissions').update<ProjectPermission>(existing.id, {
      permission_level: permissionLevel,
    })
  } catch {
    // Create new
    return await pb.collection('project_permissions').create<ProjectPermission>({
      user_id: userId,
      project_id: projectId,
      permission_level: permissionLevel,
    })
  }
}

// Get users with access to a project (including expanded user data)
export async function fetchProjectUsers(projectId: string): Promise<Array<{
  user: User
  permission: ProjectPermission
}>> {
  const pb = getPocketBase()
  const permissions = await pb.collection('project_permissions').getFullList<ProjectPermission>({
    filter: `project_id = "${projectId}"`,
    expand: 'user_id',
  })
  
  return permissions
    .filter(p => p.expand?.user_id)
    .map(p => ({
      user: p.expand!.user_id as User,
      permission: p,
    }))
}
