'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { BrushEditor } from '@/components/grid/brush-editor'
import { PlanningGrid } from '@/components/grid/planning-grid'
import { useProjectStore, useProjectActions, useCanEdit } from '@/store/project-store'

const ShareProjectModal = dynamic(
  () => import('@/components/project/share-modal').then((m) => m.ShareProjectModal),
  { ssr: false }
)
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'
import { LoginScreen } from '@/components/auth/login-screen'
import { PrioritySelect } from '@/components/ui/priority-select'
import * as api from '@/lib/pocketbase-api'
import type { Priority } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { AlertCircle, Loader2, Users, Lock, Eye, Share2 } from 'lucide-react'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth()
  const { t, dateLocale } = useTranslation()
  const [showShareModal, setShowShareModal] = useState(false)
  
  const project = useProjectStore((s) => s.project)
  const isLoading = useProjectStore((s) => s.isLoading)
  const error = useProjectStore((s) => s.error)
  const presenceList = useProjectStore((s) => s.presenceList)
  const userPermission = useProjectStore((s) => s.userPermission)
  const canEdit = useCanEdit()

  const {
    loadProject,
    reset,
    unsubscribeFromProject,
    stopPresence,
    initializePresence,
    setProject,
  } = useProjectActions()

  const isOwner = !!user && !!project && user.id === project.user_id

  // Update project priority (optimistic + persisted)
  const handlePriorityChange = async (priority: Priority) => {
    if (!project) return
    const previous = project.priority
    setProject({ ...project, priority })
    try {
      await api.updateProject(project.id, { priority })
    } catch (err) {
      console.error('Failed to update priority:', err)
      // Revert on failure
      setProject({ ...project, priority: previous })
    }
  }

  // Resolution labels
  const resolutionLabels = useMemo<Record<string, string>>(
    () => ({
      day: t('resolutions', 'day'),
      week: t('resolutions', 'week'),
      month: t('resolutions', 'month'),
      year: t('resolutions', 'year'),
    }),
    [t]
  )

  // Load project data from PocketBase (only if authenticated)
  useEffect(() => {
    // Don't load if not authenticated or still checking auth
    if (!isAuthenticated || isAuthLoading) {
      return
    }

    let mounted = true
    
    const load = async () => {
      try {
        // Pass actual username for live display
        await loadProject(projectId, user?.name)
      } catch (err) {
        console.error('Failed to load project:', err)
        // Could redirect to 404 or show error
      }
    }
    
    if (mounted) {
      load()
    }
    
    // Cleanup: unsubscribe and reset on unmount
    return () => {
      mounted = false
      stopPresence()
      unsubscribeFromProject()
      reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthenticated, isAuthLoading])

  // Separate effect: Update presence name when user name changes
  useEffect(() => {
    if (user?.name && project) {
      initializePresence(user.name)
    }
  }, [user?.name, project, initializePresence])


  // Show loading state while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Error state (check for auth errors separately)
  if (error && !project) {
    // Check if it's an authentication/authorization error
    const isAuthError = error.toLowerCase().includes('auth') || 
                        error.toLowerCase().includes('permission') ||
                        error.toLowerCase().includes('forbidden') ||
                        error.toLowerCase().includes('401') ||
                        error.toLowerCase().includes('403')
    
    if (isAuthError) {
      return (
        <div className="min-h-screen">
          <Header showProjectsLink />
          <main className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-4">
            <Lock className="w-12 h-12 text-amber-500" />
            <div className="text-ink-light text-center">
              <p className="font-medium text-ink mb-1">{t('projectDetail', 'accessDenied')}</p>
              <p className="text-sm">{t('projectDetail', 'noPermission')}</p>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="btn-notebook mt-4"
            >
              {t('projectDetail', 'backToOverview')}
            </button>
          </main>
        </div>
      )
    }
    
    // Other errors
    return (
      <div className="min-h-screen">
        <Header showProjectsLink />
        <main className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div className="text-ink-light text-center">
            <p className="font-medium text-ink mb-1">{t('projectDetail', 'loadingError')}</p>
            <p className="text-sm">{error}</p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="btn-notebook mt-4"
          >
            {t('projectDetail', 'backToOverview')}
          </button>
        </main>
      </div>
    )
  }

  // Loading state
  if (isLoading || !project) {
    return (
      <div className="min-h-screen">
        <Header showProjectsLink />
        <main className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-3">
          <Loader2 className="w-8 h-8 text-ink-faded animate-spin" />
          <div className="text-ink-light">{t('projectDetail', 'projectLoading')}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header 
        showProjectsLink
        showNewProject={false}
        projectName={project.name}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{t('common', 'error')}</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Project meta + tool bar */}
      <div className="flex-none">
        <div className="paper-card planvas-flush px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Meta zone */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-faded">{t('projectDetail', 'start')}:</span>
                <span className="font-mono text-ink">
                  {format(parseISO(project.start_date), 'dd.MM.yyyy', { locale: dateLocale })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-faded">{t('projectDetail', 'end')}:</span>
                <span className="font-mono text-ink">
                  {format(parseISO(project.end_date), 'dd.MM.yyyy', { locale: dateLocale })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-faded">{t('projectDetail', 'resolution')}:</span>
                <span className="px-2 py-0.5 bg-paper-warm rounded text-ink text-xs uppercase">
                  {resolutionLabels[project.resolution]}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-faded">{t('priorities', 'priority')}:</span>
                <PrioritySelect
                  value={project.priority}
                  onChange={handlePriorityChange}
                  disabled={!canEdit}
                />
              </div>

              {userPermission === 'view' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-paper-warm border border-paper-lines rounded text-ink-light">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{t('projectDetail', 'readOnly')}</span>
                </div>
              )}

              {/* Collaboration: presence + share */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-ink-faded" />
                  <span className="text-xs text-ink-faded">
                    {presenceList.length > 0
                      ? `${presenceList.length + 1} ${t('projectDetail', 'usersOnline')}`
                      : t('projectDetail', 'aloneHere')
                    }
                  </span>
                </div>

                {presenceList.length > 0 && (
                  <div className="flex -space-x-2">
                    {presenceList.slice(0, 5).map((presence) => (
                      <div
                        key={presence.session_id}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-surface shadow-sm"
                        style={{ backgroundColor: presence.user_color }}
                        title={presence.user_name}
                      >
                        {presence.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    ))}
                    {presenceList.length > 5 && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-ink bg-paper-warm border-2 border-surface shadow-sm">
                        +{presenceList.length - 5}
                      </div>
                    )}
                  </div>
                )}

                <span className="w-2 h-2 rounded-full bg-chip-green-300 animate-pulse" title={t('projectDetail', 'liveSyncActive')} />

                {isOwner && (
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="btn-icon"
                    title={t('dashboard', 'shareProject')}
                    aria-label={t('dashboard', 'shareProject')}
                  >
                    <Share2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Tool zone — brush alone as primary control */}
            {canEdit && (
              <div className="ml-auto flex items-center sm:pl-3 sm:border-l sm:border-paper-lines">
                <BrushEditor />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Planning Grid - the single scroll region */}
      <main className="flex-1 min-h-0 pb-4 flex flex-col">
        <PlanningGrid />
      </main>

      {isOwner && showShareModal && (
        <ShareProjectModal
          isOpen
          onClose={() => setShowShareModal(false)}
          projectId={project.id}
          projectName={project.name}
          ownerId={project.user_id}
          onProjectShareChange={(updated) => setProject(updated)}
        />
      )}
    </div>
  )
}
