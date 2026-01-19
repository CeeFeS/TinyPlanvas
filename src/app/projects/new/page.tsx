'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Layers, Save } from 'lucide-react'
import Link from 'next/link'
import { createProject } from '@/lib/pocketbase-api'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'
import { LoginScreen } from '@/components/auth/login-screen'
import type { Resolution } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'

export default function NewProjectPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { t, language } = useTranslation()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [resolution, setResolution] = useState<Resolution>('month')
  const [startDate, setStartDate] = useState(() => {
    // Default: Start of current month
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    // Default: End of next year
    const now = new Date()
    return `${now.getFullYear() + 1}-12-31`
  })

  // Resolution options with translations
  const RESOLUTION_OPTIONS: { value: Resolution; label: string; description: string }[] = [
    { value: 'day', label: t('resolutions', 'day'), description: t('resolutions', 'dayPlanning') },
    { value: 'week', label: t('resolutions', 'week'), description: t('resolutions', 'weekPlanning') },
    { value: 'month', label: t('resolutions', 'month'), description: t('resolutions', 'monthPlanning') },
    { value: 'year', label: t('resolutions', 'year'), description: t('resolutions', 'yearPlanning') },
  ]

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!name.trim()) {
      setError(t('newProject', 'nameRequired'))
      return
    }
    
    if (!startDate || !endDate) {
      setError(t('newProject', 'datesRequired'))
      return
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
      setError(t('newProject', 'startBeforeEnd'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const project = await createProject({
        name: name.trim(),
        resolution,
        start_date: startDate,
        end_date: endDate,
      })
      
      // Redirect to new project
      router.push(`/projects/${project.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
      setError(
        err instanceof Error 
          ? err.message 
          : t('newProject', 'createError')
      )
      setIsSubmitting(false)
    }
  }

  // Helper function to calculate duration string
  const calculateDuration = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const years = Math.floor(totalDays / 365)
    const months = Math.floor((totalDays % 365) / 30)
    const days = totalDays % 30
    
    const parts: string[] = []
    if (years > 0) parts.push(`${years} ${years > 1 ? t('duration', 'years') : t('duration', 'year')}`)
    if (months > 0) parts.push(`${months} ${months > 1 ? t('duration', 'months') : t('duration', 'month')}`)
    if (days > 0 && years === 0) parts.push(`${days} ${days > 1 ? t('duration', 'days') : t('duration', 'day')}`)
    
    return parts.join(', ') || `0 ${t('duration', 'days')}`
  }

  return (
    <div className="min-h-screen bg-paper-cream">
      {/* Header */}
      <header className="h-14 border-b border-paper-lines bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full px-4 flex items-center justify-between max-w-[800px] mx-auto">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-ink-light hover:text-ink transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-hand">{t('common', 'back')}</span>
          </Link>
          
          <h1 className="font-hand text-lg text-ink">{t('newProject', 'title')}</h1>
          
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-8">
        <div className="max-w-[600px] mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="paper-card bg-red-50 border-red-200 px-4 py-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Project Name */}
            <div className="paper-card p-6">
              <label className="block">
                <span className="font-hand text-ink-light text-sm mb-2 block">
                  {t('newProject', 'projectName')}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('newProject', 'projectNamePlaceholder')}
                  className="input-notebook w-full text-lg"
                  autoFocus
                  required
                />
              </label>
            </div>

            {/* Resolution */}
            <div className="paper-card p-6">
              <span className="font-hand text-ink-light text-sm mb-3 block flex items-center gap-2">
                <Layers size={16} />
                {t('newProject', 'resolution')}
              </span>
              
              <div className="grid grid-cols-2 gap-3">
                {RESOLUTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setResolution(option.value)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      resolution === option.value
                        ? 'border-chip-green-400 bg-chip-green-50'
                        : 'border-paper-lines bg-white hover:border-paper-warm hover:bg-paper-warm/30'
                    )}
                  >
                    <span className={cn(
                      'font-hand text-base block',
                      resolution === option.value ? 'text-chip-green-600' : 'text-ink'
                    )}>
                      {option.label}
                    </span>
                    <span className="text-xs text-ink-faded">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="paper-card p-6">
              <span className="font-hand text-ink-light text-sm mb-3 block flex items-center gap-2">
                <Calendar size={16} />
                {t('newProject', 'period')}
              </span>
              
              <div className="grid grid-cols-2 gap-4">
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  label={t('newProject', 'start')}
                  maxDate={endDate}
                  placeholder={t('newProject', 'startDate')}
                />
                
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  label={t('newProject', 'end')}
                  minDate={startDate}
                  placeholder={t('newProject', 'endDate')}
                />
              </div>
              
              {/* Duration hint */}
              {startDate && endDate && new Date(startDate) < new Date(endDate) && (
                <p className="text-xs text-ink-faded mt-3">
                  {t('duration', 'duration')}: {calculateDuration(startDate, endDate)}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className={cn(
                'btn-notebook w-full py-3 text-base justify-center',
                isSubmitting && 'opacity-70 cursor-wait'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('newProject', 'creating')}</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{t('newProject', 'createProject')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
