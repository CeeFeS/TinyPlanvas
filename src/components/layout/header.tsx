'use client'

import { useState } from 'react'
import { ChevronLeft, Plus, Settings, User, Shield, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'
import { SettingsModal } from '@/components/settings/settings-modal'

interface HeaderProps {
  onNewProject?: () => void
  projectName?: string
  showProjectsLink?: boolean
}

export function Header({ onNewProject, projectName, showProjectsLink }: HeaderProps) {
  const router = useRouter()
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { t } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleNewProject = () => {
    if (onNewProject) {
      onNewProject()
    } else {
      router.push('/projects/new')
    }
  }

  return (
    <>
      <header className="h-14 border-b border-paper-lines bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full px-4 flex items-center justify-between max-w-[1800px] mx-auto">
          {/* Left section */}
          <div className="flex items-center gap-3">
            {showProjectsLink && (
              <Link
                href="/"
                className="flex items-center gap-1 text-ink-light hover:text-ink transition-colors group"
              >
                <ChevronLeft size={18} className="text-ink-faded group-hover:text-ink transition-colors" />
                <span className="text-sm font-medium">{t('common', 'projects')}</span>
              </Link>
            )}
            
            <Link href="/" className="flex items-center gap-2 group">
              {/* Logo - simple paper/canvas icon */}
              <div className="w-8 h-8 rounded bg-gradient-to-br from-chip-green-200 to-chip-green-400 flex items-center justify-center shadow-sm">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="8" y1="8" x2="16" y2="8" />
                  <line x1="8" y1="12" x2="14" y2="12" />
                  <line x1="8" y1="16" x2="12" y2="16" />
                </svg>
              </div>
              
              <span className="font-hand text-xl text-ink group-hover:text-ink-blue transition-colors">
                TinyPlanvas
              </span>
            </Link>
          </div>

          {/* Center - Project name (wenn vorhanden) */}
          {projectName && (
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
              <h1 className="font-hand text-lg text-ink-light">
                {projectName}
              </h1>
            </div>
          )}

          {/* Right section */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button 
                onClick={handleNewProject}
                className="btn-notebook text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">{t('header', 'newProject')}</span>
              </button>
            )}
            
            {/* User Menu */}
            {isAuthenticated && user && (
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-warm transition-colors"
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium
                    ${isAdmin 
                      ? 'bg-gradient-to-br from-ink-blue to-blue-600' 
                      : 'bg-gradient-to-br from-chip-green-300 to-chip-green-500'
                    }`}
                  >
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-ink hidden sm:inline max-w-[120px] truncate">
                    {user.name || user.email}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUserMenu(false)} 
                    />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-paper-lines z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-paper-lines">
                        <p className="text-sm font-medium text-ink truncate">
                          {user.name || t('common', 'unnamed')}
                        </p>
                        <p className="text-xs text-ink-faded truncate">
                          {user.email}
                        </p>
                        {isAdmin && (
                          <div className="flex items-center gap-1 mt-1">
                            <Shield size={12} className="text-ink-blue" />
                            <span className="text-xs text-ink-blue">{t('header', 'administrator')}</span>
                          </div>
                        )}
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            setShowSettings(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-paper-warm transition-colors"
                        >
                          <Settings size={16} className="text-ink-light" />
                          {t('common', 'settings')}
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            logout()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={16} />
                          {t('auth', 'logout')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Settings Button (fallback when no user menu) */}
            {!isAuthenticated && (
              <button 
                className="btn-icon" 
                aria-label={t('common', 'settings')}
                onClick={() => setShowSettings(true)}
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
