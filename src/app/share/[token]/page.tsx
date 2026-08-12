'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PlanningGrid } from '@/components/grid/planning-grid'
import { useProjectStore, useProjectActions } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import * as api from '@/lib/pocketbase-api'
import { format, parseISO } from 'date-fns'
import { AlertCircle, Loader2, Eye } from 'lucide-react'
import { PriorityBadge } from '@/components/ui/priority-badge'

export default function SharedProjectPage() {
  const params = useParams()
  const token = params.token as string
  const { t, dateLocale } = useTranslation()
  const [loadError, setLoadError] = useState<string | null>(null)

  const project = useProjectStore((s) => s.project)
  const isLoading = useProjectStore((s) => s.isLoading)
  const { setAllData, reset } = useProjectActions()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      useProjectStore.setState({ isLoading: true, error: null })
      setLoadError(null)
      try {
        const data = await api.fetchSharedProject(token)
        if (!mounted) return
        setAllData(data)
      } catch (err) {
        console.error('Failed to load shared project:', err)
        if (!mounted) return
        setLoadError(err instanceof Error ? err.message : t('share', 'sharedLoadError'))
        useProjectStore.setState({ isLoading: false })
      }
    }

    load()

    return () => {
      mounted = false
      reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const resolutionLabels = useMemo<Record<string, string>>(
    () => ({
      day: t('resolutions', 'day'),
      week: t('resolutions', 'week'),
      month: t('resolutions', 'month'),
      year: t('resolutions', 'year'),
    }),
    [t]
  )

  if (loadError) {
    return (
      <div className="min-h-screen">
        <Header variant="public" />
        <main className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-4 px-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div className="text-ink-light text-center max-w-md">
            <p className="font-medium text-ink mb-1">{t('projectDetail', 'loadingError')}</p>
            <p className="text-sm">{t('share', 'sharedLoadError')}</p>
          </div>
        </main>
      </div>
    )
  }

  if (isLoading || !project) {
    return (
      <div className="min-h-screen">
        <Header variant="public" />
        <main className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-3">
          <Loader2 className="w-8 h-8 text-ink-faded animate-spin" />
          <div className="text-ink-light">{t('projectDetail', 'projectLoading')}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header variant="public" projectName={project.name} />

      <div className="flex-none px-4 py-2 bg-paper-warm/80 border-b border-paper-lines">
        <div className="flex items-center gap-2 text-ink-light text-sm">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>{t('share', 'sharedViewBanner')}</span>
        </div>
      </div>

      <div className="flex-none">
        <div className="paper-card planvas-flush px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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

            {project.priority && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-faded">{t('priorities', 'priority')}:</span>
                <PriorityBadge priority={project.priority} />
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 min-h-0 pb-4 flex flex-col">
        <PlanningGrid />
      </main>
    </div>
  )
}
