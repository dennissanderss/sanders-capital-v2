'use client'

import { useState } from 'react'
import type { TsCustomFilter } from '../types'

interface Props {
  categories: string[]
  filtersByCategory: Record<string, TsCustomFilter[]>
  onCreateFilter: (category: string, label: string, color?: string) => Promise<void>
  onUpdateFilter: (id: string, data: Partial<Pick<TsCustomFilter, 'label' | 'color' | 'sort_order'>>) => Promise<void>
  onDeleteFilter: (id: string) => Promise<void>
  onDeleteCategory: (category: string) => Promise<void>
  onRenameCategory: (oldName: string, newName: string) => Promise<void>
}

const COLORS = [
  '#3d6ea5', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

export default function FilterManager({
  categories,
  filtersByCategory,
  onCreateFilter,
  onUpdateFilter,
  onDeleteFilter,
  onDeleteCategory,
  onRenameCategory,
}: Props) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({})
  const [editingFilter, setEditingFilter] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null)
  const [renameCategoryValue, setRenameCategoryValue] = useState('')

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    // Create the category with a placeholder that we immediately add an option to
    setShowNewCategory(false)
    setNewCategoryName('')
    // Pre-set the new option input for this category
    setNewOptionInputs(prev => ({ ...prev, [name]: '' }))
    // Create an initial option so the category exists
    await onCreateFilter(name, 'Optie 1')
  }

  const handleAddOption = async (category: string) => {
    const label = (newOptionInputs[category] || '').trim()
    if (!label) return
    await onCreateFilter(category, label)
    setNewOptionInputs(prev => ({ ...prev, [category]: '' }))
  }

  const handleStartEdit = (filter: TsCustomFilter) => {
    setEditingFilter(filter.id)
    setEditLabel(filter.label)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) return
    await onUpdateFilter(id, { label: editLabel.trim() })
    setEditingFilter(null)
  }

  const handleDeleteCategory = async (category: string) => {
    if (!confirm(`Categorie "${category}" en alle opties verwijderen?`)) return
    await onDeleteCategory(category)
  }

  const handleRenameCategory = async (oldName: string) => {
    const newName = renameCategoryValue.trim()
    if (!newName || newName === oldName) {
      setRenamingCategory(null)
      return
    }
    await onRenameCategory(oldName, newName)
    setRenamingCategory(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-heading">Mijn Filters</h3>
          <p className="text-xs text-text-dim mt-0.5">Maak categorieën en opties om je trades mee te taggen</p>
        </div>
        <button
          onClick={() => setShowNewCategory(true)}
          className="px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-xs text-accent-light hover:bg-accent/30 transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Categorie
        </button>
      </div>

      {/* New category input */}
      {showNewCategory && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-accent/20 bg-accent/[0.03]">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Categorienaam (bijv. Entry Methode)"
            className="form-input flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowNewCategory(false) }}
          />
          <button onClick={handleAddCategory} className="px-3 py-2 rounded-lg bg-accent/20 border border-accent/30 text-xs text-accent-light hover:bg-accent/30">
            Toevoegen
          </button>
          <button onClick={() => setShowNewCategory(false)} className="px-2 py-2 text-text-dim hover:text-heading text-xs">
            Annuleren
          </button>
        </div>
      )}

      {/* Categories */}
      {categories.length === 0 && !showNewCategory && (
        <div className="text-center py-8 rounded-xl glass">
          <p className="text-text-muted text-sm mb-1">Nog geen filters</p>
          <p className="text-text-dim text-xs">Klik op &quot;Categorie&quot; om te beginnen.</p>
        </div>
      )}

      {categories.map(category => (
        <div key={category} className="rounded-xl glass overflow-hidden">
          {/* Category header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            {renamingCategory === category ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={renameCategoryValue}
                  onChange={(e) => setRenameCategoryValue(e.target.value)}
                  className="form-input flex-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(category); if (e.key === 'Escape') setRenamingCategory(null) }}
                />
                <button onClick={() => handleRenameCategory(category)} className="text-[10px] text-accent-light hover:text-heading">Opslaan</button>
                <button onClick={() => setRenamingCategory(null)} className="text-[10px] text-text-dim hover:text-heading">Annuleren</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-heading">{category}</h4>
                  <span className="text-[10px] text-text-dim">{filtersByCategory[category]?.length || 0} opties</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setRenamingCategory(category); setRenameCategoryValue(category) }}
                    className="p-1.5 rounded hover:bg-white/[0.06] text-text-dim hover:text-heading transition-colors"
                    title="Hernoemen"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400 transition-colors"
                    title="Verwijderen"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Options */}
          <div className="p-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {(filtersByCategory[category] || []).map(filter => (
                <div key={filter.id} className="group relative">
                  {editingFilter === filter.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="form-input text-xs w-32"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(filter.id); if (e.key === 'Escape') setEditingFilter(null) }}
                      />
                      <button onClick={() => handleSaveEdit(filter.id)} className="text-[10px] text-accent-light">OK</button>
                    </div>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors"
                      style={{
                        borderColor: filter.color ? `${filter.color}40` : 'rgba(255,255,255,0.08)',
                        backgroundColor: filter.color ? `${filter.color}10` : 'rgba(255,255,255,0.02)',
                        color: filter.color || 'inherit',
                      }}
                    >
                      {filter.label}
                      <button
                        onClick={() => handleStartEdit(filter)}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-heading transition-opacity"
                        title="Bewerken"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteFilter(filter.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-red-400 transition-opacity"
                        title="Verwijderen"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add option */}
            <div className="flex items-center gap-2">
              <input
                value={newOptionInputs[category] || ''}
                onChange={(e) => setNewOptionInputs(prev => ({ ...prev, [category]: e.target.value }))}
                placeholder="Nieuwe optie..."
                className="form-input flex-1 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(category) }}
              />
              <button
                onClick={() => handleAddOption(category)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] text-accent-light hover:bg-accent/10 border border-accent/20 transition-colors"
              >
                + Optie
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
