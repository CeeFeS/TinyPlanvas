import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware für Authentifizierungsschutz
 * 
 * Prüft ob der Benutzer authentifiziert ist, bevor geschützte Routen
 * aufgerufen werden können. Die Authentifizierung wird über das
 * PocketBase Auth-Cookie geprüft.
 */

// Routen die ohne Authentifizierung zugänglich sein sollen
const PUBLIC_ROUTES = [
  '/', // Dashboard (hat eigene Auth-Logik für Login/Setup)
]

// Statische Dateien und API-Routen ausschließen
const EXCLUDED_PATHS = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/static',
  '/.well-known', // Chrome DevTools und andere well-known Pfade
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Statische Dateien und API-Routen überspringen
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  // Öffentliche Routen überspringen
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next()
  }
  
  // Prüfe auf PocketBase Auth-Cookie
  // PocketBase speichert das Auth-Token unter 'pb_auth'
  const authCookie = request.cookies.get('pb_auth')
  
  // Wenn kein Auth-Cookie vorhanden, zur Hauptseite weiterleiten
  // (dort wird dann der Login-Screen angezeigt)
  if (!authCookie || !authCookie.value) {
    console.log('[Middleware] No auth cookie, redirecting to login:', pathname)
    
    // Speichere die ursprüngliche URL für Redirect nach Login
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    
    return NextResponse.redirect(redirectUrl)
  }
  
  // Versuche das Cookie zu parsen und zu validieren
  try {
    // Cookie ist URL-kodiert (encodeURIComponent), also zuerst dekodieren
    const decodedValue = decodeURIComponent(authCookie.value)
    const authData = JSON.parse(decodedValue)
    
    // Prüfe ob Token vorhanden ist
    if (!authData.token) {
      console.log('[Middleware] Invalid auth cookie (no token), redirecting:', pathname)
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Token ist vorhanden - Zugriff erlauben
    // Die eigentliche Token-Validierung passiert auf dem Server (PocketBase)
    return NextResponse.next()
    
  } catch {
    // Cookie ist nicht valides JSON
    console.log('[Middleware] Malformed auth cookie, redirecting:', pathname)
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }
}

// Konfiguration: Auf welchen Routen die Middleware laufen soll
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
