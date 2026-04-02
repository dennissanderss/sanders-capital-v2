'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsScreenshot } from '../types'

interface Props {
  tradeId: string
  screenshots: TsScreenshot[]
  onUpdate: () => void
}

export default function TradeScreenshots({ tradeId, screenshots: initial, onUpdate }: Props) {
  const [screenshots, setScreenshots] = useState<TsScreenshot[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setScreenshots(initial) }, [initial])

  // Reset viewing if the viewed screenshot is no longer in the list
  useEffect(() => {
    if (viewing && !screenshots.find(s => s.id === viewing)) {
      setViewing(null)
    }
  }, [viewing, screenshots])

  const getPublicUrl = (path: string) => {
    const sb = createClient()
    const { data } = sb.storage.from('trade-screenshots').getPublicUrl(path)
    return data.publicUrl
  }

  const handleUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return
    setUploading(true)

    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setUploading(false); return }

    const newScreenshots: TsScreenshot[] = []
    const nextOrder = screenshots.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue

      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/${tradeId}/${Date.now()}_${i}.${ext}`

      const { error: uploadErr } = await sb.storage.from('trade-screenshots').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        continue
      }

      const { data, error: insertErr } = await sb.from('ts_trade_screenshots').insert({
        trade_id: tradeId,
        user_id: user.id,
        storage_path: path,
        label: file.name.replace(/\.[^.]+$/, ''),
        sort_order: nextOrder + i,
      }).select().single()

      if (!insertErr && data) newScreenshots.push(data)
    }

    if (newScreenshots.length > 0) {
      setScreenshots(prev => [...prev, ...newScreenshots])
      onUpdate()
    }
    setUploading(false)
  }, [tradeId, screenshots.length, onUpdate])

  const handleDelete = useCallback(async (screenshot: TsScreenshot) => {
    const sb = createClient()
    await sb.storage.from('trade-screenshots').remove([screenshot.storage_path])
    await sb.from('ts_trade_screenshots').delete().eq('id', screenshot.id)
    setScreenshots(prev => prev.filter(s => s.id !== screenshot.id))
    onUpdate()
  }, [onUpdate])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
  }, [handleUpload])

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (blob) {
            const ext = item.type.split('/')[1] || 'png'
            imageFiles.push(new File([blob], `paste_${Date.now()}.${ext}`, { type: item.type }))
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        const dt = new DataTransfer()
        imageFiles.forEach(f => dt.items.add(f))
        handleUpload(dt.files)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handleUpload])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-heading flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Screenshots ({screenshots.length})
        </h4>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-accent-light hover:text-heading transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Toevoegen
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        className="hidden"
      />

      {/* Thumbnail grid */}
      {screenshots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {screenshots.map(s => (
            <div key={s.id} className="relative group aspect-video rounded-lg overflow-hidden bg-white/[0.03] border border-border">
              <img
                src={getPublicUrl(s.storage_path)}
                alt={s.label || 'Screenshot'}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setViewing(s.id)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setViewing(s.id)}
                  className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
              {s.label && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-[10px] text-white/80 truncate block">{s.label}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone (when no screenshots) */}
      {screenshots.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent-light bg-accent/5' : 'border-border hover:border-border-light'
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-xs text-text-muted">Uploaden...</span>
            </div>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim mx-auto mb-2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-xs text-text-dim">Sleep screenshots hierheen, klik om te uploaden, of plak met Ctrl+V</p>
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {viewing && (
        <div
          className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <button
            onClick={() => setViewing(null)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {/* Nav arrows */}
          {screenshots.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const idx = screenshots.findIndex(s => s.id === viewing)
                  if (idx === -1) return
                  const prev = idx > 0 ? screenshots[idx - 1] : screenshots[screenshots.length - 1]
                  setViewing(prev.id)
                }}
                className="absolute left-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const idx = screenshots.findIndex(s => s.id === viewing)
                  if (idx === -1) return
                  const next = idx < screenshots.length - 1 ? screenshots[idx + 1] : screenshots[0]
                  setViewing(next.id)
                }}
                className="absolute right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}
          {(() => {
            const current = screenshots.find(s => s.id === viewing)
            return current ? (
              <img
                src={getPublicUrl(current.storage_path)}
                alt={current.label || 'Screenshot'}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}
