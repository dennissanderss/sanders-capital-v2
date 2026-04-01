'use client'

import { useState, useEffect, useRef } from 'react'

const languages = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
]

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: new (
          opts: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean; layout?: number },
          id: string
        ) => void
      }
    }
    googleTranslateElementInit?: () => void
  }
}

// Inject CSS to hide the Google Translate bar that covers the nav
function injectHideBarCSS() {
  if (document.getElementById('gt-hide-bar')) return
  const style = document.createElement('style')
  style.id = 'gt-hide-bar'
  style.textContent = `
    .goog-te-banner-frame, #goog-gt-tt, .goog-te-balloon-frame,
    .goog-tooltip, .goog-tooltip:hover, .goog-text-highlight {
      display: none !important;
    }
    body { top: 0 !important; position: static !important; }
    .skiptranslate { display: none !important; }
    #google_translate_element { display: none !important; }
  `
  document.head.appendChild(style)
}

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activeLang, setActiveLang] = useState('nl')
  const ref = useRef<HTMLDivElement>(null)

  // Load Google Translate script on first open
  const initTranslate = () => {
    if (loaded) return
    injectHideBarCSS()

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'nl',
            includedLanguages: languages.map(l => l.code).join(','),
            autoDisplay: false,
          },
          'google_translate_element'
        )
      }
      setLoaded(true)
    }

    const script = document.createElement('script')
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    script.async = true
    document.body.appendChild(script)
  }

  // Trigger translation
  const selectLanguage = (langCode: string) => {
    injectHideBarCSS()

    if (langCode === 'nl') {
      // Reset to original: remove ALL possible Google Translate cookies
      const hostname = window.location.hostname
      const paths = ['/', '']
      const domains = ['', '.' + hostname, hostname]
      const expires = 'expires=Thu, 01 Jan 1970 00:00:00 UTC'
      for (const path of paths) {
        for (const domain of domains) {
          const domainStr = domain ? `; domain=${domain}` : ''
          const pathStr = path ? `; path=${path}` : ''
          document.cookie = `googtrans=${expires}${pathStr}${domainStr}`
        }
      }
      // Also try to reset via the Google Translate combo box first
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
      if (select) {
        select.value = 'nl'
        select.dispatchEvent(new Event('change'))
      }
      // Force a clean reload after a tiny delay so Google processes the reset
      setTimeout(() => window.location.reload(), 100)
      return
    }

    // Ensure Google Translate is initialized before trying to set
    if (!loaded) {
      initTranslate()
      // Wait for script to load, then retry
      const interval = setInterval(() => {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
        if (select) {
          clearInterval(interval)
          select.value = langCode
          select.dispatchEvent(new Event('change'))
        }
      }, 200)
      // Give up after 5s
      setTimeout(() => clearInterval(interval), 5000)
    } else {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
      if (select) {
        select.value = langCode
        select.dispatchEvent(new Event('change'))
      }
    }

    setActiveLang(langCode)
    setOpen(false)

    // Re-apply CSS after a short delay (Google sometimes re-injects the bar)
    setTimeout(injectHideBarCSS, 100)
    setTimeout(injectHideBarCSS, 500)
    setTimeout(injectHideBarCSS, 1500)
    setTimeout(injectHideBarCSS, 3000)
  }

  // Check current language from cookie on mount
  useEffect(() => {
    // Google Translate cookie can be in format: /nl/en or /auto/en or just /en
    const match = document.cookie.match(/googtrans=\/[^/]*\/([a-z-]+)/i)
      || document.cookie.match(/googtrans=\/([a-z-]+)/i)
    if (match && match[1] && match[1] !== 'nl') {
      setActiveLang(match[1])
      injectHideBarCSS()
    }
    // If no googtrans cookie or it's nl, keep default 'nl'
  }, [])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentLang = languages.find(l => l.code === activeLang) || languages[0]

  return (
    <div ref={ref} className="relative">
      <div id="google_translate_element" style={{ display: 'none' }} />

      <button
        onClick={() => { initTranslate(); setOpen(!open) }}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-text-dim hover:text-heading hover:bg-white/[0.06] transition-colors"
        title="Vertaal pagina"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="text-[11px] hidden sm:inline">{currentLang.flag} {currentLang.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 py-1.5 rounded-xl shadow-2xl border border-white/[0.12] min-w-[170px] z-50" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                activeLang === lang.code
                  ? 'text-heading bg-white/[0.06]'
                  : 'text-text-muted hover:text-heading hover:bg-white/[0.08]'
              }`}
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.label}</span>
              {activeLang === lang.code && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-accent-light">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
