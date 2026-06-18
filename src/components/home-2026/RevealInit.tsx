'use client'

import { useEffect } from 'react'

// Adds the `in` class to `.reveal` elements as they scroll into view.
// Hero content is intentionally not marked `.reveal` so it shows instantly;
// this only animates the below-the-fold sections (port of site.js reveal).
export default function RevealInit() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.home-2026 .reveal'))
    if (els.length === 0) return

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    )

    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
