'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, Share2, Users, Loader2, Trash2, Eye, Edit3, Search,
  Link2, Copy, Check, RefreshCw, Globe,
} from 'lucide-react'
import { useTranslation } from '@/lib/language-context'
import * as api from '@/lib/pocketbase-api'
import type { User, ProjectPermission, PermissionLevel, Project } from '@/lib/types'

interface ShareProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  ownerId: string
  /** Called when share_enabled / share_token change so parents can refresh */
  onProjectShareChange?: (project: Project) => void
}

interface UserWithPermission {
  user: User
  permission: ProjectPermission | null
}

type ShareTab = 'users' | 'link'

export function ShareProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  ownerId,
  onProjectShareChange,
}: ShareProjectModalProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ShareTab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [permissions, setPermissions] = useState<ProjectPermission[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [allUsers, projectPermissions, projectData] = await Promise.all([
          api.fetchUsers(),
          api.fetchProjectPermissions(projectId),
          api.fetchProject(projectId),
        ])

        setUsers(allUsers)
        setPermissions(projectPermissions)
        setProject(projectData)
      } catch (err) {
        console.error('Error loading data:', err)
        setError(err instanceof Error ? err.message : t('share', 'loadError'))
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen, projectId, t])

  const shareUrl = useMemo(() => {
    if (!project?.share_enabled || !project.share_token) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/share/${project.share_token}`
  }, [project?.share_enabled, project?.share_token])

  if (!isOpen) return null

  const usersWithPermissions: UserWithPermission[] = users
    .filter(user => user.id !== ownerId)
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

  const applyProjectUpdate = (updated: Project) => {
    setProject(updated)
    onProjectShareChange?.(updated)
  }

  const handleToggleLink = async () => {
    try {
      setLinkBusy(true)
      setError(null)
      if (project?.share_enabled) {
        applyProjectUpdate(await api.disableProjectShareLink(projectId))
      } else {
        applyProjectUpdate(await api.enableProjectShareLink(projectId))
      }
    } catch (err) {
      console.error('Error toggling share link:', err)
      setError(err instanceof Error ? err.message : t('share', 'linkError'))
    } finally {
      setLinkBusy(false)
    }
  }

  const handleRegenerateLink = async () => {
    if (!confirm(t('share', 'regenerateConfirm'))) return
    try {
      setLinkBusy(true)
      setError(null)
      applyProjectUpdate(await api.regenerateProjectShareLink(projectId))
    } catch (err) {
      console.error('Error regenerating share link:', err)
      setError(err instanceof Error ? err.message : t('share', 'linkError'))
    } finally {
      setLinkBusy(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('share', 'copyError'))
    }
  }

  const sharedCount = permissions.length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.2s ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-lines bg-paper-warm/50">
          <div className="flex items-center gap-3 min-w-0">
            <Share2 size={18} className="text-ink-light flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-hand text-xl text-ink leading-tight">{t('share', 'title')}</h2>
              <p className="text-xs text-ink-faded truncate">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex-shrink-0"
            aria-label={t('common', 'close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-paper-lines px-6 gap-1">
          <button
            onClick={() => setTab('users')}
            className={`
              flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors
              ${tab === 'users'
                ? 'border-ink-blue text-ink font-medium'
                : 'border-transparent text-ink-faded hover:text-ink'}
            `}
          >
            <Users size={14} />
            {t('share', 'tabUsers')}
          </button>
          <button
            onClick={() => setTab('link')}
            className={`
              flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors
              ${tab === 'link'
                ? 'border-ink-blue text-ink font-medium'
                : 'border-transparent text-ink-faded hover:text-ink'}
            `}
          >
            <Globe size={14} />
            {t('share', 'tabLink')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-ink-faded" />
            </div>
          ) : tab === 'users' ? (
            <>
              <p className="text-sm text-ink-light mb-4">
                {t('share', 'description')}{' '}
                <span className="text-ink font-medium">{t('share', 'readPermission')}</span>{' '}
                {t('common', 'or')}{' '}
                <span className="text-ink font-medium">{t('share', 'editPermission')}</span>.
              </p>

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

              <div className="flex items-center gap-2 mb-4 text-xs text-ink-faded">
                <Users size={14} />
                <span>
                  {sharedCount === 0
                    ? t('share', 'notSharedYet')
                    : `${t('share', 'sharedWith').replace('{count}', String(sharedCount)).replace('{userWord}', sharedCount === 1 ? t('profile', 'user') : t('admin', 'users'))}`
                  }
                </span>
              </div>

              {usersWithPermissions.length === 0 ? (
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
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-light">
                {t('share', 'linkDescription')}
              </p>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-paper-lines bg-paper-warm/30">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink flex items-center gap-1.5">
                    <Link2 size={14} className="text-ink-blue flex-shrink-0" />
                    {t('share', 'publicLink')}
                  </div>
                  <p className="text-xs text-ink-faded mt-0.5">
                    {project?.share_enabled
                      ? t('share', 'linkActive')
                      : t('share', 'linkInactive')}
                  </p>
                </div>
                <button
                  onClick={handleToggleLink}
                  disabled={linkBusy}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                    ${project?.share_enabled ? 'bg-ink-blue' : 'bg-paper-lines'}
                    disabled:opacity-50
                  `}
                  title={project?.share_enabled ? t('share', 'disableLink') : t('share', 'enableLink')}
                  aria-pressed={!!project?.share_enabled}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                      ${project?.share_enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>

              {project?.share_enabled && shareUrl && (
                <>
                  <div className="flex items-stretch gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 min-w-0 px-3 py-2 border border-paper-lines rounded-lg text-xs font-mono text-ink bg-surface"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={handleCopyLink}
                      className="btn-notebook btn-notebook-primary text-sm flex-shrink-0"
                      title={t('share', 'copyLink')}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? t('share', 'copied') : t('share', 'copyLink')}
                    </button>
                  </div>

                  <button
                    onClick={handleRegenerateLink}
                    disabled={linkBusy}
                    className="btn-notebook text-sm disabled:opacity-50"
                  >
                    {linkBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {t('share', 'regenerateLink')}
                  </button>

                  <p className="text-xs text-ink-faded">
                    {t('share', 'linkHint')}
                  </p>
                </>
              )}
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
        ? 'bg-surface border-ink-blue/20 shadow-sm'
        : 'bg-paper-warm/30 border-paper-lines hover:border-paper-lines/80'
      }
    `}>
      <div className={`
        w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium
        ${hasPermission
          ? 'bg-ink-blue/10 text-ink-blue'
          : 'bg-paper-lines text-ink-faded'
        }
      `}>
        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink text-sm truncate">
          {user.name || t('common', 'unnamed')}
        </div>
        <div className="text-xs text-ink-faded truncate">
          {user.email}
        </div>
      </div>

      {isSaving ? (
        <Loader2 size={18} className="animate-spin text-ink-faded" />
      ) : hasPermission ? (
        <div className="flex items-center gap-1">
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
          <button
            onClick={() => onSetPermission('view')}
            className="p-2 rounded-md bg-paper-warm text-ink-light hover:bg-ink-blue/10 hover:text-ink-blue transition-all"
            title={t('share', 'grantReadAccess')}
          >
            <Eye size={14} />
          </button>

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
