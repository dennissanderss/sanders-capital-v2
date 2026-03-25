'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false })

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  tag: string
  is_premium: boolean
  published: boolean
  reading_time: number
  created_at: string
}

interface KennisbankItem {
  id: string
  title: string
  slug: string
  content: string
  category: string
  is_premium: boolean
  order_index: number
}

const tagOptions = ['Module 1', 'Module 2', 'Module 3', 'Marktanalyse', 'Psychologie', 'Risicomanagement', 'Strategie', 'Data']
const categoryOptions = ['risicomanagement', 'psychologie', 'marktstructuur', 'fundamentals', 'data-analyse', 'verdieping']

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function AdminPage() {
  const [tab, setTab] = useState<'articles' | 'kennisbank'>('articles')
  const [articles, setArticles] = useState<Article[]>([])
  const [kennisbankItems, setKennisbankItems] = useState<KennisbankItem[]>([])
  const [editing, setEditing] = useState<Article | null>(null)
  const [editingKb, setEditingKb] = useState<KennisbankItem | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    const { data: arts } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: kbs } = await supabase
      .from('kennisbank_items')
      .select('*')
      .order('category')
      .order('order_index')

    if (arts) setArticles(arts)
    if (kbs) setKennisbankItems(kbs)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const newArticle = (): Article => ({
    id: '',
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    tag: '',
    is_premium: false,
    published: false,
    reading_time: 5,
    created_at: new Date().toISOString(),
  })

  const newKbItem = (): KennisbankItem => ({
    id: '',
    title: '',
    slug: '',
    content: '',
    category: 'risicomanagement',
    is_premium: false,
    order_index: 0,
  })

  const saveArticle = async () => {
    if (!editing) return
    const { id, created_at, ...data } = editing
    const slug = data.slug || generateSlug(data.title)

    if (id) {
      await supabase.from('articles').update({ ...data, slug, updated_at: new Date().toISOString() }).eq('id', id)
    } else {
      await supabase.from('articles').insert({ ...data, slug })
    }
    setEditing(null)
    loadData()
  }

  const deleteArticle = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) return
    await supabase.from('articles').delete().eq('id', id)
    loadData()
  }

  const saveKbItem = async () => {
    if (!editingKb) return
    const { id, ...data } = editingKb
    const slug = data.slug || generateSlug(data.title)

    if (id) {
      await supabase.from('kennisbank_items').update({ ...data, slug }).eq('id', id)
    } else {
      await supabase.from('kennisbank_items').insert({ ...data, slug })
    }
    setEditingKb(null)
    loadData()
  }

  const deleteKbItem = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return
    await supabase.from('kennisbank_items').delete().eq('id', id)
    loadData()
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-text-muted">Laden...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-semibold text-heading">Admin Panel</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('articles'); setEditing(null); setEditingKb(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'articles' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Artikelen
          </button>
          <button
            onClick={() => { setTab('kennisbank'); setEditing(null); setEditingKb(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'kennisbank' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Kennisbank
          </button>
        </div>
      </div>

      {/* ARTICLES TAB */}
      {tab === 'articles' && !editing && (
        <>
          <button
            onClick={() => setEditing(newArticle())}
            className="mb-6 px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            + Nieuw artikel
          </button>

          <div className="space-y-3">
            {articles.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 rounded-xl bg-bg-card border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-heading truncate">{a.title}</h3>
                    {a.is_premium && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold">Premium</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dim">
                    <span className={a.published ? 'text-green-400' : 'text-amber-400'}>
                      {a.published ? 'Gepubliceerd' : 'Concept'}
                    </span>
                    <span>{a.tag}</span>
                    <span>{a.reading_time} min</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => setEditing(a)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => deleteArticle(a.id)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ARTICLE EDITOR */}
      {tab === 'articles' && editing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">
              {editing.id ? 'Artikel bewerken' : 'Nieuw artikel'}
            </h2>
            <button
              onClick={() => setEditing(null)}
              className="text-sm text-text-muted hover:text-heading transition-colors"
            >
              Annuleren
            </button>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Titel</label>
            <input
              type="text"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Slug</label>
            <input
              type="text"
              value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-text-muted text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Tag</label>
              <select
                value={editing.tag}
                onChange={(e) => setEditing({ ...editing, tag: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              >
                <option value="">Geen tag</option>
                {tagOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Leestijd (min)</label>
              <input
                type="number"
                value={editing.reading_time}
                onChange={(e) => setEditing({ ...editing, reading_time: parseInt(e.target.value) || 5 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Excerpt</label>
            <textarea
              rows={2}
              value={editing.excerpt}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Afbeelding uploaden</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const ext = file.name.split('.').pop()
                  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                  const { error } = await supabase.storage.from('images').upload(fileName, file)
                  if (error) {
                    alert('Upload mislukt: ' + error.message)
                    return
                  }
                  const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
                  const markdownImg = `![${file.name}](${urlData.publicUrl})`
                  await navigator.clipboard.writeText(markdownImg)
                  alert('Afbeelding geüpload! Markdown link is gekopieerd naar je klembord.\n\nPlak het in je content met Ctrl+V.')
                }}
                className="text-sm text-text-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-border file:bg-bg-card file:text-text-muted file:text-sm file:cursor-pointer hover:file:text-heading file:transition-colors"
              />
            </div>
            <p className="text-xs text-text-dim mt-1">Upload een afbeelding → markdown link wordt automatisch gekopieerd</p>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Content</label>
            <RichEditor
              value={editing.content}
              onChange={(html) => setEditing({ ...editing, content: html })}
              supabase={supabase}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_premium}
                onChange={(e) => setEditing({ ...editing, is_premium: e.target.checked })}
                className="rounded border-border"
              />
              Premium
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="rounded border-border"
              />
              Gepubliceerd
            </label>
          </div>

          <button
            onClick={saveArticle}
            className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            Opslaan
          </button>
        </div>
      )}

      {/* KENNISBANK TAB */}
      {tab === 'kennisbank' && !editingKb && (
        <>
          <button
            onClick={() => setEditingKb(newKbItem())}
            className="mb-6 px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            + Nieuw item
          </button>

          {categoryOptions.map((cat) => {
            const catItems = kennisbankItems.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
            return (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-semibold text-heading capitalize mb-3">{cat}</h3>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-text truncate">{item.title}</span>
                        {item.is_premium && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold shrink-0">Premium</span>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => setEditingKb(item)}
                          className="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                        >
                          Bewerken
                        </button>
                        <button
                          onClick={() => deleteKbItem(item.id)}
                          className="px-3 py-1 rounded-lg border border-border text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* KENNISBANK EDITOR */}
      {tab === 'kennisbank' && editingKb && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">
              {editingKb.id ? 'Item bewerken' : 'Nieuw item'}
            </h2>
            <button
              onClick={() => setEditingKb(null)}
              className="text-sm text-text-muted hover:text-heading transition-colors"
            >
              Annuleren
            </button>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Titel</label>
            <input
              type="text"
              value={editingKb.title}
              onChange={(e) => setEditingKb({ ...editingKb, title: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Categorie</label>
              <select
                value={editingKb.category}
                onChange={(e) => setEditingKb({ ...editingKb, category: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Volgorde</label>
              <input
                type="number"
                value={editingKb.order_index}
                onChange={(e) => setEditingKb({ ...editingKb, order_index: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Content (Markdown)</label>
            <textarea
              rows={12}
              value={editingKb.content}
              onChange={(e) => setEditingKb({ ...editingKb, content: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent resize-y font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editingKb.is_premium}
              onChange={(e) => setEditingKb({ ...editingKb, is_premium: e.target.checked })}
              className="rounded border-border"
            />
            Premium
          </label>

          <button
            onClick={saveKbItem}
            className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            Opslaan
          </button>
        </div>
      )}
    </div>
  )
}
