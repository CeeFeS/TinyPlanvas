import PocketBase from 'pocketbase'

// Cookie name for auth storage
const AUTH_COOKIE_NAME = 'pb_auth'

// PocketBase Client - Singleton für Browser
let pb: PocketBase | null = null

/**
 * Custom Auth Store that saves to both localStorage and cookies
 * This allows middleware to check auth status server-side
 */
function createCookieStore() {
  return {
    save: (token: string, model: unknown) => {
      if (typeof document === 'undefined') return
      
      const data = JSON.stringify({ token, model })
      
      // Save to localStorage (PocketBase default)
      localStorage.setItem('pocketbase_auth', data)
      
      // Also save to cookie for middleware access
      // HttpOnly: false - needs to be readable by JS
      // Secure: only in production
      // SameSite: Lax for CSRF protection
      const secure = window.location.protocol === 'https:'
      const maxAge = 60 * 60 * 24 * 30 // 30 days
      document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(data)}; path=/; max-age=${maxAge}; samesite=lax${secure ? '; secure' : ''}`
    },
    clear: () => {
      if (typeof document === 'undefined') return
      
      // Clear localStorage
      localStorage.removeItem('pocketbase_auth')
      
      // Clear cookie
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`
    },
  }
}

export function getPocketBase(): PocketBase {
  // Determine PocketBase URL:
  // - If NEXT_PUBLIC_POCKETBASE_URL is set, use it
  // - Otherwise use current origin (same origin, works with reverse proxy)
  // - For local dev without Docker, set NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
  
  if (typeof window === 'undefined') {
    // Server-side: Always create new instance
    // Use internal Docker URL if available, otherwise fall back to configured URL
    const serverUrl = process.env.POCKETBASE_INTERNAL_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'
    return new PocketBase(serverUrl)
  }
  
  // Client-side: Use configured URL or current origin (for reverse proxy setup)
  const clientUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || window.location.origin
  
  // Client-side: Reuse instance
  if (!pb) {
    pb = new PocketBase(clientUrl)
    
    // Auto-refresh auth token
    pb.autoCancellation(false)
    
    // Set up cookie sync for middleware
    const cookieStore = createCookieStore()
    
    // Sync on auth changes
    pb.authStore.onChange((token, model) => {
      if (token && model) {
        cookieStore.save(token, model)
      } else {
        cookieStore.clear()
      }
    })
    
    // Initial sync if already authenticated
    if (pb.authStore.isValid && pb.authStore.token) {
      cookieStore.save(pb.authStore.token, pb.authStore.model)
    }
  }
  
  return pb
}

// Clear auth cookie (call on logout)
export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`
}

// Export für einfachen Zugriff
export const pocketbase = typeof window !== 'undefined' 
  ? getPocketBase() 
  : null
