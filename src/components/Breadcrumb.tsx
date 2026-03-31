import Link from 'next/link'

interface Crumb {
  label: string
  href?: string
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-text-dim mb-8 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-border-light">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-text-muted hover:text-heading transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-heading font-medium' : 'text-text-muted'}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
