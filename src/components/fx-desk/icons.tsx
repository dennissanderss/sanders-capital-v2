import type { SVGProps, ReactNode } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'stroke' | 'fill' | 'children'> & {
  size?: number
  stroke?: number
  fill?: string
  vb?: number
  d?: string
  children?: ReactNode
}

function Icon({ d, size = 16, stroke = 1.6, fill = 'none', vb = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children || (d ? <path d={d} /> : null)}
    </svg>
  )
}

export const Icons = {
  Briefing: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 3h11l4 4v14H5z" />
      <path d="M16 3v4h4" />
      <path d="M9 12h7M9 16h7M9 8h3" />
    </Icon>
  ),
  Engine: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
    </Icon>
  ),
  Help: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.2.9-1.2 1.6v.4" />
      <path d="M11.5 17h.01" />
    </Icon>
  ),
  Arrow: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 5v14M12 5l-5 5M12 5l5 5" />
    </Icon>
  ),
  ArrowDown: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 19V5M12 19l-5-5M12 19l5-5" />
    </Icon>
  ),
  Check: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </Icon>
  ),
  Cross: (p: IconProps) => (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  ),
  Dot: (p: IconProps) => (
    <Icon {...p} fill="currentColor" stroke={undefined}>
      <circle cx="12" cy="12" r="5" />
    </Icon>
  ),
  Chevron: (p: IconProps) => (
    <Icon {...p}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  ),
  ArrowRight: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  ),
  ArrowLeft: (p: IconProps) => (
    <Icon {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  ),
  Info: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6h.01" />
    </Icon>
  ),
  Pulse: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </Icon>
  ),
  Layers: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </Icon>
  ),
  Scale: (p: IconProps) => (
    <Icon {...p}>
      <path d="M12 4v15M7 19h10M6 8l6-3 6 3" />
      <path d="M6 8l-2.5 5a2.5 2.5 0 0 0 5 0L6 8zM18 8l-2.5 5a2.5 2.5 0 0 0 5 0L18 8z" />
    </Icon>
  ),
  Filter: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" />
    </Icon>
  ),
  Clock: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
}
