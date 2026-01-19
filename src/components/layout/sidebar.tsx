'use client'

import { FolderOpen, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/language-context'
import type { Project } from '@/lib/types'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  currentProjectId?: string
}

export function Sidebar({ isOpen, onClose, projects, currentProjectId }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-paper-lines z-40',
          'transform transition-transform duration-200 ease-out',
          'lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button (mobile) */}
        <button
          onClick={onClose}
          className="btn-icon absolute top-3 right-3 lg:hidden"
          aria-label={t('sidebar', 'closeSidebar')}
        >
          <X size={18} />
        </button>
        
        {/* Sidebar content */}
        <div className="p-4">
          <h2 className="font-hand text-lg text-ink-light mb-3 flex items-center gap-2">
            <FolderOpen size={18} />
            {t('common', 'projects')}
          </h2>
          
          <nav className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-sm text-ink-faded italic py-2">
                {t('sidebar', 'noProjects')}
              </p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded text-sm',
                    'hover:bg-paper-warm transition-colors',
                    currentProjectId === project.id 
                      ? 'bg-paper-warm text-ink font-medium' 
                      : 'text-ink-light'
                  )}
                >
                  <ChevronRight 
                    size={14} 
                    className={cn(
                      'transition-transform',
                      currentProjectId === project.id && 'rotate-90'
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              ))
            )}
          </nav>
        </div>
      </aside>
    </>
  )
}
