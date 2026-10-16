import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const gilroy = localFont({
  src: [
    { path: './fonts/Gilroy-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Gilroy-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Gilroy-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-gilroy',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Saquá360',
  description: 'Acesso institucional restrito ao Saquá360.',
  generator: 'v0.app',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${gilroy.variable} bg-background`}>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <Toaster theme="light" position="top-right" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
