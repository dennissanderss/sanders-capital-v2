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
          opts: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          id: string
        ) => void
      }
    }
    googleTranslateElementInit?: () => void
  }
}

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load Google Translate script on first open
  const initTranslate = () => {
    if (loaded) return

    // Define callback
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

    // Load script
    const script = document.createElement('script')
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    script.async = true
    document.body.appendChild(script)
  }

  // Trigger translation via Google Translate
  const selectLanguage = (langCode: string) => {
    // Find the Google Translate select element and change its value
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
    if (select) {
      select.value = langCode
      select.dispatchEvent(new Event('change'))
    }
    setOpen(false)
  }

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Hidden Google Translate element */}
      <div id="google_translate_element" className="hidden" />

      {/* Trigger button */}
      <button
        onClick={() => {
          initTranslate()
          setOpen(!open)
        }}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-text-dim hover:text-heading hover:bg-white/[0.06] transition-colors"
        title="Vertaal pagina"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="text-[11px] hidden sm:inline">NL</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1 py-1.5 rounded-xl shadow-2xl border border-white/[0.12] min-w-[160px] z-50" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-muted hover:text-heading hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
          {!loaded && (
            <p className="px-3 py-1 text-[10px] text-text-dim">Vertaling wordt geladen...</p>
          )}
        </div>
      )}
    </div>
  )
}
