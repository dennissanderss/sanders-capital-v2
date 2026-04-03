'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNoteItems, useNotepad } from '../hooks/useNotes'
import type { TsNoteItem } from '../types'

export default function NotesTab() {
  const { items, loading: itemsLoading, create, update, remove, reorder } = useNoteItems()
  const { note, loading: noteLoading, save: saveNote } = useNotepad()

  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync notepad content from DB
  useEffect(() => {
    if (note && !noteDirty) {
      setNoteContent(note.content)
    }
  }, [note, noteDirty])

  // Auto-save notepad with debounce
  const debouncedSaveNote = useCallback((content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveNote(content)
      setNoteDirty(false)
    }, 1000)
  }, [saveNote])

  const handleNoteChange = (content: string) => {
    setNoteContent(content)
    setNoteDirty(true)
    debouncedSaveNote(content)
  }

  // Add new checklist item
  const handleAdd = async () => {
    const text = newText.trim()
    if (!text) return
    setNewText('')
    await create(text, items.length)
    inputRef.current?.focus()
  }

  // Toggle check
  const handleToggle = async (item: TsNoteItem) => {
    await update(item.id, { checked: !item.checked })
  }

  // Start inline edit
  const startEdit = (item: TsNoteItem) => {
    setEditingId(item.id)
    setEditText(item.text)
    setTimeout(() => editRef.current?.focus(), 0)
  }

  // Save inline edit
  const saveEdit = async () => {
    if (!editingId) return
    const text = editText.trim()
    if (text) {
      await update(editingId, { text })
    }
    setEditingId(null)
    setEditText('')
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  // Move item up/down
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= items.length) return

    const reordered = items.map((item, i) => {
      if (i === index) return { id: item.id, sort_order: swapIndex }
      if (i === swapIndex) return { id: item.id, sort_order: index }
      return { id: item.id, sort_order: i }
    })
    await reorder(reordered)
  }

  // Delete item
  const handleDelete = async (id: string) => {
    await remove(id)
  }

  const loading = itemsLoading || noteLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Notities</h2>
          <p className="text-xs text-text-dim mt-0.5">Checklist en vrije notities voor je trading sessie.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Checklist section */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-heading mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Checklist
            {items.length > 0 && (
              <span className="text-[10px] text-text-dim font-normal ml-auto">
                {items.filter(i => i.checked).length}/{items.length} afgerond
              </span>
            )}
          </h3>

          {/* Add new item */}
          <div className="flex gap-2 mb-4">
            <input
              ref={inputRef}
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Nieuw item toevoegen..."
              className="form-input flex-1 text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-dim">Geen items</p>
              <p className="text-xs text-text-dim mt-1">Voeg een item toe om te beginnen.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5 ${
                    item.checked ? 'opacity-60' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggle(item)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.checked
                        ? 'bg-accent/30 border-accent/50'
                        : 'border-white/20 hover:border-accent/40'
                    }`}
                  >
                    {item.checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Text / Edit */}
                  {editingId === item.id ? (
                    <input
                      ref={editRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={saveEdit}
                      className="form-input flex-1 text-sm py-0.5"
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(item)}
                      className={`flex-1 text-sm cursor-text select-none ${
                        item.checked ? 'line-through text-text-dim' : 'text-heading'
                      }`}
                    >
                      {item.text}
                    </span>
                  )}

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Move up */}
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-white/10 text-text-dim hover:text-heading transition-colors disabled:opacity-20"
                      title="Omhoog"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    {/* Move down */}
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 rounded hover:bg-white/10 text-text-dim hover:text-heading transition-colors disabled:opacity-20"
                      title="Omlaag"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400 transition-colors"
                      title="Verwijderen"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {items.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-accent/50 transition-all duration-300"
                    style={{ width: `${(items.filter(i => i.checked).length / items.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-dim">
                  {Math.round((items.filter(i => i.checked).length / items.length) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Free-form notes section */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-heading mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
            Vrije notities
            {noteDirty && (
              <span className="text-[10px] text-amber-400 ml-auto">opslaan...</span>
            )}
            {!noteDirty && note && (
              <span className="text-[10px] text-text-dim ml-auto">opgeslagen</span>
            )}
          </h3>

          <textarea
            value={noteContent}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Schrijf hier je gedachten, observaties, marktnotities..."
            rows={20}
            className="form-input w-full resize-none text-sm leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
