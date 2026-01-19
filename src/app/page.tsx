'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, Loader2, AlertCircle, Trash2, User, Share2 } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { LoginScreen } from '@/components/auth/login-screen'
import { SetupScreen } from '@/components/auth/setup-screen'
import { ShareProjectModal } from '@/components/project/share-modal'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'
import { format, parseISO } from 'date-fns'
import * as api from '@/lib/pocketbase-api'
import type { ProjectWithOwner } from '@/lib/pocketbase-api'
import { getPocketBase } from '@/lib/pocketbase'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading, refreshUser, user } = useAuth()
  const { t, language, dateLocale } = useTranslation()
  const [projects, setProjects] = useState<ProjectWithOwner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [shareModalProject, setShareModalProject] = useState<ProjectWithOwner | null>(null)

  // Check if first-time setup is needed
  useEffect(() => {
    const checkSetup = async () => {
      console.log('[Page] checkSetup called, isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading)
      
      if (isAuthenticated) {
        // User is authenticated, setup is complete
        console.log('[Page] User authenticated, marking setup complete')
        setNeedsSetup(false)
        api.markSetupComplete()
        return
      }
      
      if (!isAuthLoading) {
        // Not authenticated - check server for setup status
        // Server (app_status collection) is the source of truth, NOT localStorage
        try {
          const hasExistingUsers = await api.hasUsers()
          console.log('[Page] Server check - users exist:', hasExistingUsers)
          setNeedsSetup(!hasExistingUsers)
        } catch (err) {
          console.error('[Page] Error checking users:', err)
          // Show setup screen if we truly can't determine
          // This is the safest default for fresh installations
          console.log('[Page] Cannot determine, showing setup screen')
          setNeedsSetup(true)
        }
      }
    }
    checkSetup()
  }, [isAuthenticated, isAuthLoading])

  // Auto-promote first user to admin if needed
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isAuthenticated && !isAuthLoading) {
        try {
          const wasPromoted = await api.promoteToAdminIfOnlyUser()
          if (wasPromoted) {
            console.log('[Auth] User was promoted to admin, refreshing...')
            refreshUser()
          }
        } catch (err) {
          console.error('[Auth] Error checking admin status:', err)
        }
      }
    }
    checkAdminStatus()
  }, [isAuthenticated, isAuthLoading, refreshUser])

  // Load projects from PocketBase
  useEffect(() => {
    // Don't load projects if not authenticated
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    const loadProjects = async () => {
      try {
        setIsLoading(true)
        const data = await api.fetchProjects()
        setProjects(data)
        setError(null)
      } catch (err) {
        console.error('Failed to load projects:', err)
        setError(err instanceof Error ? err.message : t('dashboard', 'loadingError'))
      } finally {
        setIsLoading(false)
      }
    }
    
    loadProjects()
    
    // Subscribe to project changes for realtime updates
    const pb = getPocketBase()
    pb.collection('projects').subscribe<ProjectWithOwner>('*', (e) => {
      setProjects(prev => {
        if (e.action === 'create') {
          // Check if already exists (avoid duplicates from our own create)
          if (prev.find(p => p.id === e.record.id)) {
            return prev
          }
          return [e.record, ...prev]
        } else if (e.action === 'update') {
          return prev.map(p => p.id === e.record.id ? e.record : p)
        } else if (e.action === 'delete') {
          return prev.filter(p => p.id !== e.record.id)
        }
        return prev
      })
    })
    
    return () => {
      try {
        pb.collection('projects').unsubscribe('*')
      } catch { /* ignore */ }
    }
  }, [isAuthenticated, t])

  // Delete project
  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm(t('dashboard', 'deleteConfirm'))) {
      return
    }
    
    try {
      setDeletingId(id)
      await api.deleteProject(id)
      // Realtime subscription will remove it from the list
    } catch (err) {
      console.error('Failed to delete project:', err)
      setError(err instanceof Error ? err.message : t('dashboard', 'deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  // Show loading state while checking auth or setup status
  if (isAuthLoading || (needsSetup === null && !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Show setup screen if no users exist yet
  if (!isAuthenticated && needsSetup) {
    return (
      <SetupScreen 
        onSetupComplete={() => {
          setNeedsSetup(false)
          api.markSetupComplete()
          refreshUser()
        }} 
      />
    )
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Resolution labels
  const resolutionLabels: Record<string, string> = {
    day: t('resolutions', 'days'),
    week: t('resolutions', 'weeks'),
    month: t('resolutions', 'months'),
    year: t('resolutions', 'years'),
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-hand text-3xl text-ink mb-2">
            {t('dashboard', 'myProjects')}
          </h1>
          <p className="text-ink-light">
            {t('dashboard', 'projectOverview')}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{t('common', 'error')}</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Project Count */}
        <div className="flex items-center mb-6">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-ink-faded animate-spin" />
          ) : (
            <span className="text-sm text-ink-faded">
              {projects.length} {projects.length === 1 ? t('dashboard', 'project') : t('dashboard', 'projectsCount')}
            </span>
          )}
        </div>

        {/* Project Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-ink-faded animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onDelete={(e) => handleDeleteProject(project.id, e)}
                isDeleting={deletingId === project.id}
                isOwner={user?.id === project.user_id}
                onShare={() => setShareModalProject(project)}
                resolutionLabels={resolutionLabels}
              />
            ))}
          </div>
        )}

        {/* Share Modal */}
        {shareModalProject && (
          <ShareProjectModal
            isOpen={true}
            onClose={() => setShareModalProject(null)}
            projectId={shareModalProject.id}
            projectName={shareModalProject.name}
            ownerId={shareModalProject.user_id}
          />
        )}
      </main>
    </div>
  )
}

// ==================== Sub-Components ====================

interface ProjectCardProps {
  project: ProjectWithOwner
  onDelete: (e: React.MouseEvent) => void
  isDeleting: boolean
  isOwner: boolean
  onShare: () => void
  resolutionLabels: Record<string, string>
}

function ProjectCard({ project, onDelete, isDeleting, isOwner, onShare, resolutionLabels }: ProjectCardProps) {
  const { t, language, dateLocale } = useTranslation()

  // Besitzername aus den geladenen Daten oder Fallback
  const ownerName = project.ownerName || project.ownerEmail || t('common', 'unknown')

  // Handle share button click
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onShare()
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <article className="paper-card p-5 hover:shadow-paper-hover transition-all cursor-pointer group relative">
        {/* Action Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Share Button - nur für Besitzer */}
          {isOwner && (
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-white/80 hover:bg-ink-blue/10 hover:text-ink-blue transition-colors"
              title={t('dashboard', 'shareProject')}
            >
              <Share2 size={14} />
            </button>
          )}
          
          {/* Delete Button - nur für Besitzer */}
          {isOwner && (
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-2 rounded-full bg-white/80 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
              title={t('dashboard', 'deleteProject')}
            >
              {isDeleting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          )}
        </div>
        
        {/* Project Name */}
        <h2 className="font-hand text-xl text-ink group-hover:text-ink-blue transition-colors mb-3 pr-8">
          {project.name}
        </h2>
        
        {/* Meta Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-ink-light">
            <Calendar size={14} />
            <span>
              {format(parseISO(project.start_date), 'dd.MM.yyyy', { locale: dateLocale })}
              {' – '}
              {format(parseISO(project.end_date), 'dd.MM.yyyy', { locale: dateLocale })}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-ink-light">
            <Clock size={14} />
            <span>{t('dashboard', 'resolution')}: {resolutionLabels[project.resolution]}</span>
          </div>
        </div>

        {/* Projekt-Details: Angelegt, Aktualisiert, Besitzer */}
        <div className="mt-4 pt-4 border-t border-paper-lines space-y-2">
          {/* Besitzer & Freigabe-Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-ink-light">
              <User size={12} className="text-ink-faded" />
              <span className="text-ink-faded">{t('dashboard', 'owner')}:</span>
              <span className="font-medium text-ink">{ownerName}</span>
            </div>
            {/* Shared Badge - wenn nicht Besitzer */}
            {!isOwner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-blue/10 text-ink-blue text-xs">
                <Share2 size={10} />
                {t('dashboard', 'shared')}
              </span>
            )}
          </div>
          
          {/* Angelegt & Aktualisiert in einer Zeile */}
          <div className="flex items-center justify-between text-xs text-ink-faded">
            <div className="flex items-center gap-1">
              <span>{t('dashboard', 'createdAt')}:</span>
              <span className="text-ink-light">
                {project.created 
                  ? format(parseISO(project.created), 'dd.MM.yy', { locale: dateLocale })
                  : '–'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>{t('dashboard', 'updatedAt')}:</span>
              <span className="text-ink-light">
                {project.updated 
                  ? format(parseISO(project.updated), 'dd.MM.yy HH:mm', { locale: dateLocale })
                  : '–'}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

function EmptyState() {
  const { t } = useTranslation()

  return (
    <div className="paper-card p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-warm flex items-center justify-center">
        <Calendar size={32} className="text-ink-faded" />
      </div>
      
      <h2 className="font-hand text-xl text-ink mb-2">
        {t('dashboard', 'noProjects')}
      </h2>
      <p className="text-ink-light mb-6 max-w-md mx-auto">
        {t('dashboard', 'noProjectsDesc')}
      </p>
      
      <Link href="/projects/new" className="btn-notebook btn-notebook-primary inline-flex">
        <Plus size={18} />
        {t('dashboard', 'createFirstProject')}
      </Link>
    </div>
  )
}
