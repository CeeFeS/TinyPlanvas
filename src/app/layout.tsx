import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from '@/components/providers'
import { THEME_INIT_SCRIPT } from '@/lib/theme-context'

// Self-hosted (bundled) fonts — avoids fonts.googleapis.com fetches during Docker/CI builds.
const sourceSerif = localFont({
  src: './fonts/source-serif-4-latin-wght-normal.woff2',
  weight: '200 900',
  style: 'normal',
  variable: '--font-source-serif',
  display: 'swap',
})

const sourceSans = localFont({
  src: './fonts/source-sans-3-latin-wght-normal.woff2',
  weight: '200 900',
  style: 'normal',
  variable: '--font-source-sans',
  display: 'swap',
})

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TinyPlanvas - Ressourcen-Planung',
  description: 'Visuelles Tool zur Ressourcen- und Projektplanung',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="de" 
      className={`${sourceSerif.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${sourceSans.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
