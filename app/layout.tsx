import type { Metadata, Viewport } from 'next'
import { ServiceWorkerAnmelden } from '@/komponenten/sw-anmelden'
import { THEMA_SKRIPT } from '@/lib/thema'
import './globals.css'

export const metadata: Metadata = {
  title: 'Takt — Laufanalyse',
  description: 'Selbstgehostete Laufanalyse auf Grundlage von intervals.icu.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Randlos bis in die Safe Area, sonst greifen env(safe-area-inset-*) nicht.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEMA_SKRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerAnmelden />
      </body>
    </html>
  )
}
