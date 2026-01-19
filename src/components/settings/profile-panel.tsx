'use client'

import { useState } from 'react'
import { LogOut, User, Mail, Shield, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'

export function ProfilePanel() {
  const { user, logout, isAdmin } = useAuth()
  const { t, language } = useTranslation()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300))
    logout()
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-faded">{t('auth', 'notLoggedIn')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div>
        <h3 className="font-hand text-xl text-ink mb-4">{t('profile', 'yourProfile')}</h3>
        
        <div className="paper-card p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-chip-green-200 to-chip-green-400 flex items-center justify-center shadow-md flex-shrink-0">
              <User size={28} className="text-white" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-hand text-lg text-ink truncate">
                {user.name || t('common', 'unnamed')}
              </h4>
              
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-ink-light">
                  <Mail size={14} className="text-ink-faded" />
                  <span className="truncate">{user.email}</span>
                </div>
                
                {isAdmin && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield size={14} className="text-ink-blue" />
                    <span className="text-ink-blue font-medium">{t('profile', 'administrator')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div>
        <h3 className="font-hand text-lg text-ink mb-3">{t('profile', 'accountInfo')}</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-paper-lines">
            <span className="text-sm text-ink-light">{t('profile', 'userId')}</span>
            <code className="text-xs bg-paper-warm px-2 py-1 rounded font-mono text-ink-light">
              {user.id}
            </code>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-paper-lines">
            <span className="text-sm text-ink-light">{t('profile', 'emailVerified')}</span>
            <span className={`text-sm font-medium ${user.verified ? 'text-chip-green-500' : 'text-ink-faded'}`}>
              {user.verified ? t('common', 'yes') : t('common', 'no')}
            </span>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-paper-lines">
            <span className="text-sm text-ink-light">{t('profile', 'role')}</span>
            <span className={`text-sm font-medium ${isAdmin ? 'text-ink-blue' : 'text-ink'}`}>
              {isAdmin ? t('profile', 'administrator') : t('profile', 'user')}
            </span>
          </div>

          {user.created && (
            <div className="flex items-center justify-between py-3 border-b border-paper-lines">
              <span className="text-sm text-ink-light">{t('profile', 'createdAt')}</span>
              <span className="text-sm text-ink">
                {new Date(user.created).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="pt-4 border-t border-paper-lines">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg
                   text-red-600 bg-red-50 hover:bg-red-100
                   transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <LogOut size={18} />
          )}
          <span className="font-medium text-sm">{t('auth', 'logout')}</span>
        </button>
      </div>
    </div>
  )
}
