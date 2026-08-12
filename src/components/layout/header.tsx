'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, Plus, Settings, Shield, LogOut, Sun, Moon, Globe } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/language-context'
import { useTheme } from '@/lib/theme-context'

// The settings dialog pulls in the admin panel and is opened rarely, so it must
// not weigh down the header that ships with every page.
const SettingsModal = dynamic(
  () => import('@/components/settings/settings-modal').then((m) => m.SettingsModal),
  { ssr: false }
)

interface HeaderProps {
  onNewProject?: () => void
  projectName?: string
  showProjectsLink?: boolean
  /** When false, hides the "New project" CTA (e.g. while inside a project). Defaults to true. */
  showNewProject?: boolean
  /**
   * Public share / guest chrome: hide account menu, settings, and "new project"
   * even if a session exists in this browser.
   */
  variant?: 'app' | 'public'
}

export function Header({
  onNewProject,
  projectName,
  showProjectsLink,
  showNewProject = true,
  variant = 'app',
}: HeaderProps) {
  const router = useRouter()
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const isPublic = variant === 'public'

  const toggleLanguage = () => {
    setLanguage(language === 'de' ? 'en' : 'de')
  }

  const handleNewProject = () => {
    if (onNewProject) {
      onNewProject()
    } else {
      router.push('/projects/new')
    }
  }

  return (
    <>
      <header className="h-14 border-b border-paper-lines bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full px-6 flex items-center justify-between w-full">
          {/* Left section */}
          <div className="flex items-center gap-3">
            {!isPublic && showProjectsLink && (
              <Link
                href="/"
                className="flex items-center gap-1 text-ink-light hover:text-ink transition-colors group"
              >
                <ChevronLeft size={18} className="text-ink-faded group-hover:text-ink transition-colors" />
                <span className="text-sm font-medium">{t('common', 'projects')}</span>
              </Link>
            )}
            
            <div className="flex items-center gap-2">
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
              
              {isPublic ? (
                <span className="font-hand text-2xl text-ink leading-none">
                  TinyPlanvas
                </span>
              ) : (
                <Link href="/" className="font-hand text-2xl text-ink group-hover:text-ink-blue transition-colors leading-none hover:text-ink-blue">
                  TinyPlanvas
                </Link>
              )}
            </div>
          </div>

          {/* Center - Project name (wenn vorhanden) */}
          {projectName && (
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
              <h1 className="font-hand text-xl text-ink leading-tight">
                {projectName}
              </h1>
            </div>
          )}

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Language toggle for public share (no settings menu there) */}
            {isPublic && (
              <button
                onClick={toggleLanguage}
                className="btn-icon gap-1 w-auto px-2 text-xs font-semibold tracking-wide"
                aria-label={t('header', 'toggleLanguage')}
                title={t('header', 'toggleLanguage')}
              >
                <Globe size={16} />
                <span>{language === 'de' ? 'DE' : 'EN'}</span>
              </button>
            )}

            {/* Theme Toggle — also useful on public shares */}
            <button
              onClick={toggleTheme}
              className="btn-icon"
              aria-label={t('header', 'toggleTheme')}
              title={t('header', 'toggleTheme')}
            >
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!isPublic && isAuthenticated && showNewProject && (
              <button 
                onClick={handleNewProject}
                className="btn-notebook text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">{t('header', 'newProject')}</span>
              </button>
            )}
            
            {/* User Menu — never on public share pages */}
            {!isPublic && isAuthenticated && user && (
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
                    <div className="absolute right-0 top-full mt-1 w-56 bg-surface rounded-lg shadow-lg border border-paper-lines z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
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

            {/* Settings Button (fallback when no user menu) — not on public shares */}
            {!isPublic && !isAuthenticated && (
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

      {/* Settings Modal - mounted on demand so its chunk loads on first open */}
      {!isPublic && showSettings && (
        <SettingsModal isOpen onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
