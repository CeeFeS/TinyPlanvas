import type { Metadata } from 'next'
import { Kalam, Source_Sans_3, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

// Handschrift-Font für Überschriften
const kalam = Kalam({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-kalam',
  display: 'swap',
})

// Clean Sans für Daten
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Mono für Zahlen
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
      className={`${kalam.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
