'use client'

import type { TsCustomFilter } from '../types'

interface Props {
  filtersByCategory: Record<string, TsCustomFilter[]>
  selectedIds: string[]
  onToggle: (filterId: string) => void
  compact?: boolean
}

/**
 * Renders filter categories with selectable chip options.
 * Used in both QuickTradeForm and the full TradeFormModal.
 */
export default function TradeFilterChips({ filtersByCategory, selectedIds, onToggle, compact }: Props) {
  const categories = Object.keys(filtersByCategory).sort()

  if (categories.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {categories.map(category => (
        <div key={category}>
          <label className="block text-[10px] text-text-dim mb-1">{category}</label>
          <div className="flex flex-wrap gap-1.5">
            {filtersByCategory[category].map(filter => {
              const isSelected = selectedIds.includes(filter.id)
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onToggle(filter.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    isSelected
                      ? 'shadow-sm'
                      : 'hover:border-white/[0.15]'
                  }`}
                  style={isSelected ? {
                    borderColor: filter.color ? `${filter.color}60` : 'rgba(61,110,165,0.5)',
                    backgroundColor: filter.color ? `${filter.color}20` : 'rgba(61,110,165,0.15)',
                    color: filter.color || '#7ba3d0',
                  } : {
                    borderColor: 'rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    color: 'inherit',
                  }}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
