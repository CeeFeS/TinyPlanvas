'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, Shield, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/language-context'
import * as api from '@/lib/pocketbase-api'

interface SetupScreenProps {
  onSetupComplete: () => void
}

export function SetupScreen({ onSetupComplete }: SetupScreenProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Double-check on mount that no users exist
  useEffect(() => {
    const checkUsers = async () => {
      try {
        const hasExistingUsers = await api.hasUsers()
        if (hasExistingUsers) {
          console.log('[SetupScreen] Users already exist, redirecting to login')
          api.markSetupComplete()
          onSetupComplete()
          return
        }
      } catch (err) {
        console.error('[SetupScreen] Error checking users:', err)
      } finally {
        setIsChecking(false)
      }
    }
    checkUsers()
  }, [onSetupComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !email || !password) {
      setError(t('setup', 'fillAllFields'))
      return
    }

    if (password.length < 8) {
      setError(t('setup', 'minPassword'))
      return
    }

    try {
      setIsLoading(true)
      
      // Create the first admin user (this also logs in and sets admin status)
      // The function now checks for existing users internally
      await api.createFirstAdmin({
        name,
        email,
        password,
        passwordConfirm: password,
      })

      console.log('[SetupScreen] Admin user created and logged in')
      
      // Mark setup as complete
      api.markSetupComplete()
      
      onSetupComplete()
    } catch (err) {
      console.error('[SetupScreen] Setup failed:', err)
      
      // Check if it's a specific PocketBase error
      const pbError = err as { 
        status?: number
        message?: string
        response?: { 
          message?: string
          data?: Record<string, { code: string; message: string }> 
        }
        data?: { 
          data?: Record<string, { code: string; message: string }> 
        }
      }
      
      let errorMessage = t('setup', 'createAdminError')
      
      // Try to extract field-specific errors from response
      const fieldErrors = pbError.response?.data || pbError.data?.data
      if (fieldErrors) {
        const errors = Object.entries(fieldErrors)
          .map(([field, error]) => {
            const msg = typeof error === 'object' ? error.message : String(error)
            return `${field}: ${msg}`
          })
          .join('\n')
        if (errors) {
          errorMessage = errors
        }
      } else if (pbError.response?.message) {
        errorMessage = pbError.response.message
      } else if (pbError.message) {
        errorMessage = pbError.message
      }
      
      // Add status code info
      if (pbError.status) {
        errorMessage += ` (Status: ${pbError.status})`
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state while checking for existing users
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-40 h-40 bg-gradient-to-br from-chip-green-100/40 to-chip-green-200/20 rounded-full blur-3xl"
          style={{ top: '15%', left: '10%' }}
        />
        <div 
          className="absolute w-56 h-56 bg-gradient-to-br from-ink-blue/10 to-chip-blue-100/20 rounded-full blur-3xl"
          style={{ bottom: '20%', right: '5%' }}
        />
      </div>

      {/* Setup Card */}
      <div className="w-full max-w-md relative">
        <div className="paper-card-lifted p-8 relative overflow-hidden">
          {/* Subtle pattern */}
          <div 
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                transparent,
                transparent 31px,
                var(--paper-lines) 31px,
                var(--paper-lines) 32px
              )`,
              backgroundPosition: '0 8px',
            }}
          />

          {/* Header */}
          <div className="text-center mb-8 relative">
            {/* Logo with sparkle */}
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 mx-auto rounded-xl bg-gradient-to-br from-chip-green-200 to-chip-green-400 flex items-center justify-center shadow-lg">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="8" y1="8" x2="16" y2="8" />
                  <line x1="8" y1="12" x2="14" y2="12" />
                  <line x1="8" y1="16" x2="12" y2="16" />
                </svg>
              </div>
              <Sparkles 
                size={24} 
                className="absolute -top-2 -right-2 text-yellow-400 animate-pulse" 
              />
            </div>

            <h1 className="font-hand text-3xl text-ink mb-2">
              {t('setup', 'welcome')}
            </h1>
            <p className="text-ink-light text-sm">
              {t('setup', 'createAdmin')}
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-6 bg-ink-blue/5 border border-ink-blue/20 rounded-lg p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-ink-blue flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink">{t('setup', 'initialSetup')}</p>
              <p className="text-xs text-ink-light mt-1">
                {t('setup', 'firstUserInfo')}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          )}

          {/* Setup Form */}
          <form onSubmit={handleSubmit} className="space-y-5 relative">
            {/* Name Input */}
            <div>
              <label 
                htmlFor="name" 
                className="block text-sm font-medium text-ink-light mb-2"
              >
                {t('setup', 'yourName')}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('setup', 'namePlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-paper-lines bg-white/50 
                         text-ink placeholder:text-ink-faded
                         focus:outline-none focus:ring-2 focus:ring-ink-blue/30 focus:border-ink-blue
                         transition-all duration-200"
                disabled={isLoading}
                autoComplete="name"
              />
            </div>

            {/* Email Input */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-ink-light mb-2"
              >
                {t('auth', 'email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('setup', 'adminEmailPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-paper-lines bg-white/50 
                         text-ink placeholder:text-ink-faded
                         focus:outline-none focus:ring-2 focus:ring-ink-blue/30 focus:border-ink-blue
                         transition-all duration-200"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Password Input */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-ink-light mb-2"
              >
                {t('auth', 'password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('setup', 'minChars')}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-paper-lines bg-white/50 
                           text-ink placeholder:text-ink-faded
                           focus:outline-none focus:ring-2 focus:ring-ink-blue/30 focus:border-ink-blue
                           transition-all duration-200"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faded hover:text-ink-light transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg font-hand text-lg
                       bg-gradient-to-r from-ink-blue to-blue-600 
                       text-white shadow-md
                       hover:from-blue-600 hover:to-blue-700
                       focus:outline-none focus:ring-2 focus:ring-ink-blue focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{t('setup', 'settingUp')}</span>
                </>
              ) : (
                <>
                  <Shield size={20} />
                  <span>{t('setup', 'createAdminBtn')}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Decorative tape */}
        <div 
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-yellow-100/80 shadow-sm"
          style={{ transform: 'translateX(-50%) rotate(-1deg)' }}
        />
      </div>
    </div>
  )
}
