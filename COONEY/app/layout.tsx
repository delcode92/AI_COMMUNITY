import type { Metadata } from 'next'
import React from 'react'

import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Geist_Mono, Inter as V0_Font_Inter, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from 'next/font/google'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ThemeProvider } from '@/components/theme-provider'

// Initialize fonts
const _inter = V0_Font_Inter({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _sourceSerif_4 = V0_Font_Source_Serif_4({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800","900"] })

export const metadata: Metadata = {
  title: 'Cooney - AI Learning Buddy',
  description: 'Learn with Cooney the Raccoon - Your personal AI learning companion',
  generator: '',
  icons: {
    icon: [
      {
        url: '/cooney.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/cooney.png',
        media: '(prefers-color-scheme: dark)',
      },
      
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-white">
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
