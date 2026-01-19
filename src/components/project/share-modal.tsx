'use client'

import { useState, useEffect } from 'react'
import { X, Share2, Users, Loader2, Check, Trash2, Eye, Edit3, UserPlus, Search } from 'lucide-react'
import { useTranslation } from '@/lib/language-context'
import * as api from '@/lib/pocketbase-api'
import type { User, ProjectPermission, PermissionLevel } from '@/lib/types'

interface ShareProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  ownerId: string
}

interface UserWithPermission {
  user: User
  permission: ProjectPermission | null
}

export function ShareProjectModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName,
  ownerId 
}: ShareProjectModalProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [permissions, setPermissions] = useState<ProjectPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load all users and current permissions
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const [allUsers, projectPermissions] = await Promise.all([
          api.fetchUsers(),
          api.fetchProjectPermissions(projectId)
        ])
        
        setUsers(allUsers)
        setPermissions(projectPermissions)
      } catch (err) {
        console.error('Error loading data:', err)
        setError(err instanceof Error ? err.message : t('share', 'loadError'))
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen, projectId, t])

  if (!isOpen) return null

  // Combine users with their permissions
  const usersWithPermissions: UserWithPermission[] = users
    // Filter out owner (they don't need explicit permissions)
    .filter(user => user.id !== ownerId)
    // Apply search
    .filter(user => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      )
    })
    .map(user => ({
      user,
      permission: permissions.find(p => p.user_id === user.id) || null
    }))

  // Set/update permission
  const handleSetPermission = async (userId: string, level: PermissionLevel) => {
    try {
      setSavingUserId(userId)
      setError(null)
      
      const updatedPermission = await api.upsertPermission(userId, projectId, level)
      
      setPermissions(prev => {
        const existing = prev.find(p => p.user_id === userId)
        if (existing) {
          return prev.map(p => p.user_id === userId ? updatedPermission : p)
        }
        return [...prev, updatedPermission]
      })
    } catch (err) {
      console.error('Error setting permission:', err)
      setError(err instanceof Error ? err.message : t('share', 'saveError'))
    } finally {
      setSavingUserId(null)
    }
  }

  // Remove permission
  const handleRemovePermission = async (userId: string) => {
    const permission = permissions.find(p => p.user_id === userId)
    if (!permission) return

    try {
      setSavingUserId(userId)
      setError(null)
      
      await api.deletePermission(permission.id)
      setPermissions(prev => prev.filter(p => p.id !== permission.id))
    } catch (err) {
      console.error('Error removing permission:', err)
      setError(err instanceof Error ? err.message : t('share', 'removeError'))
    } finally {
      setSavingUserId(null)
    }
  }

  // Number of shared users
  const sharedCount = permissions.length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.2s ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-lines bg-paper-warm/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ink-blue/20 to-ink-blue/10 flex items-center justify-center">
              <Share2 size={20} className="text-ink-blue" />
            </div>
            <div>
              <h2 className="font-hand text-xl text-ink">{t('share', 'title')}</h2>
              <p className="text-xs text-ink-faded truncate max-w-[280px]">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Info Text */}
          <p className="text-sm text-ink-light mb-4">
            {t('share', 'description')}{' '}
            <span className="text-ink font-medium">{t('share', 'readPermission')}</span>{' '}
            {t('common', 'or')}{' '}
            <span className="text-ink font-medium">{t('share', 'editPermission')}</span>.
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faded" />
            <input
              type="text"
              placeholder={t('share', 'searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-paper-lines rounded-lg text-sm focus:outline-none focus:border-ink-blue"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 mb-4 text-xs text-ink-faded">
            <Users size={14} />
            <span>
              {sharedCount === 0 
                ? t('share', 'notSharedYet')
                : `${t('share', 'sharedWith').replace('{count}', String(sharedCount)).replace('{userWord}', sharedCount === 1 ? t('profile', 'user') : t('admin', 'users'))}`
              }
            </span>
          </div>

          {/* User List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-ink-faded" />
            </div>
          ) : usersWithPermissions.length === 0 ? (
            <div className="text-center py-8 text-ink-faded">
              {searchQuery 
                ? t('share', 'noUsersFound')
                : t('share', 'noOtherUsers')
              }
            </div>
          ) : (
            <div className="space-y-2">
              {usersWithPermissions.map(({ user, permission }) => (
                <UserPermissionRow
                  key={user.id}
                  user={user}
                  permission={permission}
                  isSaving={savingUserId === user.id}
                  onSetPermission={(level) => handleSetPermission(user.id, level)}
                  onRemovePermission={() => handleRemovePermission(user.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-paper-lines bg-paper-cream/50 flex justify-end">
          <button
            onClick={onClose}
            className="btn-notebook btn-notebook-primary"
          >
            {t('common', 'done')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== Sub-Components ====================

interface UserPermissionRowProps {
  user: User
  permission: ProjectPermission | null
  isSaving: boolean
  onSetPermission: (level: PermissionLevel) => void
  onRemovePermission: () => void
}

function UserPermissionRow({ 
  user, 
  permission, 
  isSaving, 
  onSetPermission, 
  onRemovePermission 
}: UserPermissionRowProps) {
  const { t } = useTranslation()
  const hasPermission = !!permission
  const currentLevel = permission?.permission_level

  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-lg border transition-all
      ${hasPermission 
        ? 'bg-white border-ink-blue/20 shadow-sm' 
        : 'bg-paper-warm/30 border-paper-lines hover:border-paper-lines/80'
      }
    `}>
      {/* Avatar */}
      <div className={`
        w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium
        ${hasPermission 
          ? 'bg-ink-blue/10 text-ink-blue' 
          : 'bg-paper-lines text-ink-faded'
        }
      `}>
        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink text-sm truncate">
          {user.name || t('common', 'unnamed')}
        </div>
        <div className="text-xs text-ink-faded truncate">
          {user.email}
        </div>
      </div>

      {/* Permission Buttons */}
      {isSaving ? (
        <Loader2 size={18} className="animate-spin text-ink-faded" />
      ) : hasPermission ? (
        <div className="flex items-center gap-1">
          {/* View Button */}
          <button
            onClick={() => onSetPermission('view')}
            className={`
              p-2 rounded-md transition-all flex items-center gap-1 text-xs
              ${currentLevel === 'view'
                ? 'bg-ink-blue text-white'
                : 'bg-paper-warm text-ink-light hover:bg-paper-lines'
              }
            `}
            title={t('share', 'readOnlyTitle')}
          >
            <Eye size={14} />
          </button>
          
          {/* Edit Button */}
          <button
            onClick={() => onSetPermission('edit')}
            className={`
              p-2 rounded-md transition-all flex items-center gap-1 text-xs
              ${currentLevel === 'edit'
                ? 'bg-ink-blue text-white'
                : 'bg-paper-warm text-ink-light hover:bg-paper-lines'
              }
            `}
            title={t('share', 'editTitle')}
          >
            <Edit3 size={14} />
          </button>

          {/* Remove Button */}
          <button
            onClick={onRemovePermission}
            className="p-2 rounded-md text-ink-faded hover:bg-red-50 hover:text-red-500 transition-all ml-1"
            title={t('share', 'removeAccess')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {/* Add View Permission */}
          <button
            onClick={() => onSetPermission('view')}
            className="p-2 rounded-md bg-paper-warm text-ink-light hover:bg-ink-blue/10 hover:text-ink-blue transition-all"
            title={t('share', 'grantReadAccess')}
          >
            <Eye size={14} />
          </button>
          
          {/* Add Edit Permission */}
          <button
            onClick={() => onSetPermission('edit')}
            className="p-2 rounded-md bg-paper-warm text-ink-light hover:bg-ink-blue/10 hover:text-ink-blue transition-all"
            title={t('share', 'grantEditAccess')}
          >
            <Edit3 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
