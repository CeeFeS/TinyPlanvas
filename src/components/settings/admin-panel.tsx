'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Trash2, 
  Shield, 
  ShieldOff,
  Eye, 
  Edit, 
  Loader2, 
  AlertCircle,
  Search,
  FolderOpen,
  X,
  Check
} from 'lucide-react'
import type { User, Project, ProjectPermission } from '@/lib/types'
import * as api from '@/lib/pocketbase-api'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'

type AdminTab = 'users' | 'permissions'

export function AdminPanel() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-hand text-xl text-ink mb-2">{t('admin', 'title')}</h3>
        <p className="text-sm text-ink-light">
          {t('admin', 'subtitle')}
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-paper-lines pb-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all
            ${activeTab === 'users' 
              ? 'bg-white text-ink border border-paper-lines border-b-white -mb-[1px]' 
              : 'text-ink-light hover:text-ink hover:bg-paper-warm/50'
            }`}
        >
          <Users size={16} />
          {t('admin', 'users')}
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all
            ${activeTab === 'permissions' 
              ? 'bg-white text-ink border border-paper-lines border-b-white -mb-[1px]' 
              : 'text-ink-light hover:text-ink hover:bg-paper-warm/50'
            }`}
        >
          <FolderOpen size={16} />
          {t('admin', 'projectPermissions')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'permissions' && <ProjectPermissions />}
    </div>
  )
}

// ==================== User Management ====================

function UserManagement() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const data = await api.fetchUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(t('admin', 'loadingError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUser?.id) {
      setError(t('admin', 'cannotChangeOwnAdmin'))
      return
    }

    try {
      setProcessingId(user.id)
      await api.setUserAdmin(user.id, !user.isAdmin)
      setUsers(prev => 
        prev.map(u => u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u)
      )
    } catch (err) {
      console.error('Failed to toggle admin:', err)
      setError(t('admin', 'adminToggleError'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      setError(t('admin', 'cannotDeleteSelf'))
      return
    }

    if (!confirm(t('admin', 'deleteConfirm'))) {
      return
    }

    try {
      setProcessingId(userId)
      await api.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      console.error('Failed to delete user:', err)
      setError(t('admin', 'deleteUserError'))
    } finally {
      setProcessingId(null)
    }
  }

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header with Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faded" />
          <input
            type="text"
            placeholder={t('admin', 'searchUsers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-paper-lines bg-white
                     text-sm text-ink placeholder:text-ink-faded
                     focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
          />
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="btn-notebook btn-notebook-primary text-sm"
        >
          <Plus size={16} />
          {t('admin', 'addUser')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* User List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-ink-faded" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-ink-faded">
          {searchQuery ? t('admin', 'noUsersFound') : t('admin', 'noUsersYet')}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className={`paper-card p-4 flex items-center gap-4 transition-all
                ${processingId === user.id ? 'opacity-50' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${user.isAdmin 
                  ? 'bg-gradient-to-br from-ink-blue to-blue-600' 
                  : 'bg-gradient-to-br from-paper-lines to-paper-warm'
                }`}
              >
                {user.isAdmin ? (
                  <Shield size={18} className="text-white" />
                ) : (
                  <Users size={18} className="text-ink-light" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink truncate">
                    {user.name || t('common', 'unnamed')}
                  </span>
                  {user.id === currentUser?.id && (
                    <span className="text-xs bg-ink-blue/10 text-ink-blue px-2 py-0.5 rounded">
                      {t('common', 'you')}
                    </span>
                  )}
                </div>
                <span className="text-sm text-ink-light truncate block">
                  {user.email}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleAdmin(user)}
                  disabled={processingId === user.id || user.id === currentUser?.id}
                  className={`btn-icon ${user.isAdmin ? 'text-ink-blue' : 'text-ink-faded'} 
                    disabled:opacity-30 disabled:cursor-not-allowed`}
                  title={user.isAdmin ? t('admin', 'revokeAdmin') : t('admin', 'makeAdmin')}
                >
                  {processingId === user.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : user.isAdmin ? (
                    <ShieldOff size={16} />
                  ) : (
                    <Shield size={16} />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  disabled={processingId === user.id || user.id === currentUser?.id}
                  className="btn-icon text-ink-faded hover:text-red-500 hover:bg-red-50
                    disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('admin', 'deleteUser')}
                >
                  {processingId === user.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <AddUserModal 
          onClose={() => setShowAddUser(false)} 
          onUserAdded={(newUser) => {
            setUsers(prev => [...prev, newUser])
            setShowAddUser(false)
          }}
        />
      )}
    </div>
  )
}

// ==================== Add User Modal ====================

interface AddUserModalProps {
  onClose: () => void
  onUserAdded: (user: User) => void
}

function AddUserModal({ onClose, onUserAdded }: AddUserModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !email || !password) {
      setError(t('setup', 'fillAllFields'))
      return
    }

    if (password.length < 8) {
      setError(t('setup', 'minPassword'))
      return
    }

    try {
      setIsLoading(true)
      const newUser = await api.createUser({
        name,
        email,
        password,
        passwordConfirm: password,
        isAdmin,
      })
      onUserAdded(newUser)
    } catch (err) {
      console.error('Failed to create user:', err)
      setError(t('admin', 'createUserError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-hand text-lg text-ink">{t('admin', 'addUserTitle')}</h4>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-light mb-1">{t('admin', 'name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('setup', 'namePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-paper-lines bg-white
                       text-ink placeholder:text-ink-faded text-sm
                       focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-light mb-1">{t('auth', 'email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('auth', 'emailPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-paper-lines bg-white
                       text-ink placeholder:text-ink-faded text-sm
                       focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-light mb-1">{t('auth', 'password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('setup', 'minChars')}
              className="w-full px-3 py-2 rounded-lg border border-paper-lines bg-white
                       text-ink placeholder:text-ink-faded text-sm
                       focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-paper-lines text-ink-blue 
                       focus:ring-ink-blue/20"
            />
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-ink-blue" />
              <span className="text-sm text-ink">{t('admin', 'createAsAdmin')}</span>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-notebook text-sm"
            >
              {t('common', 'cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-notebook btn-notebook-primary text-sm"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : (
                t('common', 'create')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==================== Project Permissions ====================

function ProjectPermissions() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectPermissions, setProjectPermissions] = useState<ProjectPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddPermission, setShowAddPermission] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadPermissions(selectedProject.id)
    }
  }, [selectedProject])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [projectsData, usersData] = await Promise.all([
        api.fetchProjects(),
        api.fetchUsers(),
      ])
      setProjects(projectsData)
      setUsers(usersData)
      if (projectsData.length > 0) {
        setSelectedProject(projectsData[0])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(t('admin', 'loadingDataError'))
    } finally {
      setIsLoading(false)
    }
  }

  const loadPermissions = async (projectId: string) => {
    try {
      setIsLoadingPermissions(true)
      const perms = await api.fetchProjectPermissions(projectId)
      setProjectPermissions(perms)
    } catch (err) {
      console.error('Failed to load permissions:', err)
      setError(t('admin', 'loadingPermissionsError'))
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  const handleUpdatePermission = async (permId: string, level: 'view' | 'edit') => {
    try {
      setProcessingId(permId)
      await api.updatePermission(permId, { permission_level: level })
      setProjectPermissions(prev =>
        prev.map(p => p.id === permId ? { ...p, permission_level: level } : p)
      )
    } catch (err) {
      console.error('Failed to update permission:', err)
      setError(t('admin', 'updatePermissionError'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeletePermission = async (permId: string) => {
    try {
      setProcessingId(permId)
      await api.deletePermission(permId)
      setProjectPermissions(prev => prev.filter(p => p.id !== permId))
    } catch (err) {
      console.error('Failed to delete permission:', err)
      setError(t('admin', 'deletePermissionError'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleAddPermission = async (userId: string, level: 'view' | 'edit') => {
    if (!selectedProject) return

    try {
      const perm = await api.createPermission({
        user_id: userId,
        project_id: selectedProject.id,
        permission_level: level,
      })
      // Reload to get expanded user data
      await loadPermissions(selectedProject.id)
      setShowAddPermission(false)
    } catch (err) {
      console.error('Failed to add permission:', err)
      setError(t('admin', 'addPermissionError'))
    }
  }

  // Users without access to selected project
  const usersWithoutAccess = users.filter(
    u => !projectPermissions.some(p => p.user_id === u.id) && !u.isAdmin
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-ink-faded" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-ink-faded">
        {t('admin', 'noProjectsYet')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Project Selector */}
      <div>
        <label className="block text-sm text-ink-light mb-2">{t('admin', 'selectProject')}</label>
        <select
          value={selectedProject?.id || ''}
          onChange={e => {
            const project = projects.find(p => p.id === e.target.value)
            setSelectedProject(project || null)
          }}
          className="w-full px-3 py-2 rounded-lg border border-paper-lines bg-white
                   text-ink text-sm
                   focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
        >
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Permissions List */}
      {selectedProject && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-ink">
              {t('admin', 'permissionsFor')} &quot;{selectedProject.name}&quot;
            </h4>
            <button
              onClick={() => setShowAddPermission(true)}
              disabled={usersWithoutAccess.length === 0}
              className="btn-notebook text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              {t('admin', 'addPermission')}
            </button>
          </div>

          <p className="text-xs text-ink-faded">
            {t('admin', 'adminsHaveFullAccess')}
          </p>

          {isLoadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-faded" />
            </div>
          ) : projectPermissions.length === 0 ? (
            <div className="text-center py-6 text-ink-faded text-sm">
              {t('admin', 'noPermissionsYet')}
            </div>
          ) : (
            <div className="space-y-2">
              {projectPermissions.map(perm => {
                const permUser = perm.expand?.user_id
                return (
                  <div
                    key={perm.id}
                    className={`paper-card p-3 flex items-center gap-3 transition-all
                      ${processingId === perm.id ? 'opacity-50' : ''}`}
                  >
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-ink text-sm truncate block">
                        {permUser?.name || t('common', 'unknown')}
                      </span>
                      <span className="text-xs text-ink-faded truncate block">
                        {permUser?.email || perm.user_id}
                      </span>
                    </div>

                    {/* Permission Level Toggle */}
                    <div className="flex items-center gap-1 bg-paper-warm rounded-lg p-1">
                      <button
                        onClick={() => handleUpdatePermission(perm.id, 'view')}
                        disabled={processingId === perm.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
                          ${perm.permission_level === 'view'
                            ? 'bg-white text-ink shadow-sm'
                            : 'text-ink-faded hover:text-ink'
                          }`}
                      >
                        <Eye size={12} />
                        {t('admin', 'view')}
                      </button>
                      <button
                        onClick={() => handleUpdatePermission(perm.id, 'edit')}
                        disabled={processingId === perm.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
                          ${perm.permission_level === 'edit'
                            ? 'bg-white text-ink shadow-sm'
                            : 'text-ink-faded hover:text-ink'
                          }`}
                      >
                        <Edit size={12} />
                        {t('admin', 'edit')}
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleDeletePermission(perm.id)}
                      disabled={processingId === perm.id}
                      className="btn-icon text-ink-faded hover:text-red-500 hover:bg-red-50"
                      title={t('admin', 'removePermission')}
                    >
                      {processingId === perm.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Permission Modal */}
      {showAddPermission && selectedProject && (
        <AddPermissionModal
          users={usersWithoutAccess}
          onClose={() => setShowAddPermission(false)}
          onAdd={handleAddPermission}
        />
      )}
    </div>
  )
}

// ==================== Add Permission Modal ====================

interface AddPermissionModalProps {
  users: User[]
  onClose: () => void
  onAdd: (userId: string, level: 'view' | 'edit') => Promise<void>
}

function AddPermissionModal({ users, onClose, onAdd }: AddPermissionModalProps) {
  const { t } = useTranslation()
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [level, setLevel] = useState<'view' | 'edit'>('view')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return

    setIsLoading(true)
    try {
      await onAdd(selectedUserId, level)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-hand text-lg text-ink">{t('admin', 'addPermission')}</h4>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-light mb-1">{t('admin', 'users')}</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-paper-lines bg-white
                       text-ink text-sm
                       focus:outline-none focus:ring-2 focus:ring-ink-blue/20 focus:border-ink-blue"
            >
              <option value="">{t('admin', 'selectUser')}</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-ink-light mb-2">{t('admin', 'permission')}</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                ${level === 'view' 
                  ? 'border-ink-blue bg-ink-blue/5' 
                  : 'border-paper-lines hover:border-ink-faded'
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value="view"
                  checked={level === 'view'}
                  onChange={() => setLevel('view')}
                  className="sr-only"
                />
                <Eye size={16} className={level === 'view' ? 'text-ink-blue' : 'text-ink-faded'} />
                <div>
                  <span className="text-sm font-medium text-ink block">{t('admin', 'view')}</span>
                  <span className="text-xs text-ink-faded">{t('admin', 'viewOnly')}</span>
                </div>
                {level === 'view' && <Check size={16} className="text-ink-blue ml-auto" />}
              </label>

              <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                ${level === 'edit' 
                  ? 'border-ink-blue bg-ink-blue/5' 
                  : 'border-paper-lines hover:border-ink-faded'
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value="edit"
                  checked={level === 'edit'}
                  onChange={() => setLevel('edit')}
                  className="sr-only"
                />
                <Edit size={16} className={level === 'edit' ? 'text-ink-blue' : 'text-ink-faded'} />
                <div>
                  <span className="text-sm font-medium text-ink block">{t('admin', 'edit')}</span>
                  <span className="text-xs text-ink-faded">{t('admin', 'fullAccess')}</span>
                </div>
                {level === 'edit' && <Check size={16} className="text-ink-blue ml-auto" />}
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-notebook text-sm"
            >
              {t('common', 'cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedUserId}
              className="flex-1 btn-notebook btn-notebook-primary text-sm disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : (
                t('common', 'add')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
