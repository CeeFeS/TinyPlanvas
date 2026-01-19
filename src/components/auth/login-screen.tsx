'use client'

import { useState } from 'react'
import { Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'

export function LoginScreen() {
  const { login, isLoading } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError(t('auth', 'loginError'))
      return
    }

    try {
      await login({ email, password })
    } catch (err) {
      console.error('Login failed:', err)
      setError(
        err instanceof Error 
          ? t('auth', 'invalidCredentials')
          : t('auth', 'genericError')
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Decorative paper elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Scattered paper squares */}
        <div 
          className="absolute w-32 h-32 bg-white/40 rounded shadow-paper rotate-12"
          style={{ top: '10%', left: '5%' }}
        />
        <div 
          className="absolute w-24 h-24 bg-white/30 rounded shadow-paper -rotate-6"
          style={{ top: '20%', right: '10%' }}
        />
        <div 
          className="absolute w-40 h-40 bg-white/20 rounded shadow-paper rotate-3"
          style={{ bottom: '15%', left: '8%' }}
        />
        <div 
          className="absolute w-28 h-28 bg-white/35 rounded shadow-paper -rotate-12"
          style={{ bottom: '20%', right: '5%' }}
        />
        
        {/* Notebook lines hint */}
        <div 
          className="absolute w-64 h-4 bg-paper-lines/30"
          style={{ top: '35%', left: '-5%', transform: 'rotate(-5deg)' }}
        />
        <div 
          className="absolute w-48 h-3 bg-paper-lines/20"
          style={{ bottom: '30%', right: '-3%', transform: 'rotate(8deg)' }}
        />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md relative">
        {/* Card with paper effect */}
        <div className="paper-card-lifted p-8 relative overflow-hidden">
          {/* Subtle notebook lines in card */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
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
            {/* Logo */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-chip-green-200 to-chip-green-400 flex items-center justify-center shadow-md">
              <svg 
                viewBox="0 0 24 24" 
                className="w-10 h-10 text-white"
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

            <h1 className="font-hand text-3xl text-ink mb-2">
              TinyPlanvas
            </h1>
            <p className="text-ink-light text-sm">
              {t('auth', 'loginTitle')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-shake">
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

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 relative">
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
                placeholder={t('auth', 'emailPlaceholder')}
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
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-paper-lines bg-white/50 
                           text-ink placeholder:text-ink-faded
                           focus:outline-none focus:ring-2 focus:ring-ink-blue/30 focus:border-ink-blue
                           transition-all duration-200"
                  disabled={isLoading}
                  autoComplete="current-password"
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
                       bg-gradient-to-r from-chip-green-300 to-chip-green-400 
                       text-white shadow-md
                       hover:from-chip-green-400 hover:to-chip-green-500
                       focus:outline-none focus:ring-2 focus:ring-chip-green-300 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{t('auth', 'loggingIn')}</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>{t('auth', 'login')}</span>
                </>
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-ink-faded whitespace-pre-line">
            {t('auth', 'contactAdmin')}
          </p>
        </div>

        {/* Decorative tape strips */}
        <div 
          className="absolute -top-2 left-8 w-16 h-6 bg-yellow-100/80 shadow-sm"
          style={{ transform: 'rotate(-3deg)' }}
        />
        <div 
          className="absolute -top-2 right-8 w-14 h-5 bg-yellow-100/60 shadow-sm"
          style={{ transform: 'rotate(2deg)' }}
        />
      </div>

      {/* Shake animation for error */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}
