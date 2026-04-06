import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ScrollProgress from '@/components/ScrollProgress'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Sanders Capital | Kennis. Discipline. Groei.',
    template: '%s | Sanders Capital',
  },
  description:
    'Educatieve content over financiële markten. Leer over trading, risicomanagement en marktpsychologie. Gratis kennisbank, tools en macro-analyse.',
  keywords: ['trading', 'forex', 'educatie', 'risicomanagement', 'marktanalyse', 'kennisbank', 'fundamentele analyse', 'technische analyse', 'Sanders Capital'],
  authors: [{ name: 'Sanders Capital' }],
  creator: 'Sanders Capital',
  publisher: 'Sanders Capital',
  metadataBase: new URL('https://sanderscapital.nl'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/assets/images/logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/assets/images/logo.png',
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'Sanders Capital | Kennis. Discipline. Groei.',
    description:
      'Educatieve content over financiële markten. Leer over trading, risicomanagement en marktpsychologie.',
    url: 'https://sanderscapital.nl',
    siteName: 'Sanders Capital',
    locale: 'nl_NL',
    type: 'website',
    images: [
      {
        url: '/assets/images/logo.png',
        width: 512,
        height: 512,
        alt: 'Sanders Capital logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Sanders Capital | Kennis. Discipline. Groei.',
    description: 'Educatieve content over financiële markten. Leer over trading, risicomanagement en marktpsychologie.',
    images: ['/assets/images/logo.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className={`${cormorant.variable} ${dmSans.variable}`}>
      <head>
        {/* 1. Google Consent Mode default (EERST — vóór alles) */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'denied',
            personalization_storage: 'denied',
            security_storage: 'granted',
            wait_for_update: 2000
          });
          gtag('set', 'ads_data_redaction', true);
          gtag('set', 'url_passthrough', true);
        `}} />
        {/* 2. CookieYes banner script */}
        <script id="cookieyes" src="https://cdn-cookieyes.com/client_data/956ffa0d845583fb24c80defb450883b/script.js" />
        {/* 3. Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-9XPW26WZ3D" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-9XPW26WZ3D');
        `}} />
        {/* 4. CookieYes consent update listener → stuurt consent door naar Google */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener("cookieyes_consent_update", function(eventData) {
            var detail = eventData.detail;
            if (!detail) return;
            var consentObj = {};
            (detail.accepted || []).forEach(function(cat) {
              if (cat === "analytics") { consentObj.analytics_storage = "granted"; consentObj.personalization_storage = "granted"; }
              if (cat === "advertisement") { consentObj.ad_storage = "granted"; consentObj.ad_user_data = "granted"; consentObj.ad_personalization = "granted"; }
              if (cat === "functional") { consentObj.functionality_storage = "granted"; }
            });
            (detail.rejected || []).forEach(function(cat) {
              if (cat === "analytics") { consentObj.analytics_storage = "denied"; consentObj.personalization_storage = "denied"; }
              if (cat === "advertisement") { consentObj.ad_storage = "denied"; consentObj.ad_user_data = "denied"; consentObj.ad_personalization = "denied"; }
              if (cat === "functional") { consentObj.functionality_storage = "denied"; }
            });
            gtag("consent", "update", consentObj);
          });
        `}} />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <ScrollProgress />
        <Header />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
