'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, LoginCredentials } from './types'
import * as api from './pocketbase-api'

// ==================== Types ====================

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

// ==================== Context ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ==================== Provider ====================

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from stored token
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if there's a valid stored auth
        const currentUser = api.getCurrentUser()
        if (currentUser) {
          // Refresh to validate token
          const refreshedUser = await api.refreshAuth()
          setUser(refreshedUser)
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        api.logout()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes
    const unsubscribe = api.onAuthStateChange((newUser) => {
      setUser(newUser)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Login handler
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true)
    try {
      const loggedInUser = await api.login(credentials)
      setUser(loggedInUser)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout handler
  const logout = useCallback(() => {
    api.logout()
    setUser(null)
  }, [])

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!api.isAuthenticated()) {
      setUser(null)
      return
    }
    
    try {
      const refreshedUser = await api.refreshAuth()
      setUser(refreshedUser)
    } catch (error) {
      console.error('Failed to refresh user:', error)
      api.logout()
      setUser(null)
    }
  }, [])

  // Check admin status using API function (includes localStorage fallback)
  const checkIsAdmin = user ? api.isAdmin() : false

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: checkIsAdmin,
    login,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ==================== Hook ====================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// ==================== Require Auth Wrapper ====================

interface RequireAuthProps {
  children: ReactNode
  fallback?: ReactNode
  requireAdmin?: boolean
}

export function RequireAuth({ children, fallback, requireAdmin = false }: RequireAuthProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback ?? null
  }

  if (requireAdmin && !isAdmin) {
    return fallback ?? null
  }

  return <>{children}</>
}
