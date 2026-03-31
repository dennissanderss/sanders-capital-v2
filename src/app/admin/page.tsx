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

interface KennisbankDocument {
  name: string
  url: string
  size: number
}

interface KennisbankItem {
  id: string
  title: string
  slug: string
  content: string
  category: string
  is_premium: boolean
  order_index: number
  documents?: KennisbankDocument[]
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  is_premium: boolean
  order_index: number
}

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'free' | 'premium' | 'admin'
  created_at: string
}

interface ToolSetting {
  id: string
  slug: string
  name: string
  is_premium: boolean
  visible: boolean
}

interface CentralBankRate {
  id: string
  currency: string
  country: string
  bank: string
  rate: number | null
  target: number | null
  flag: string
  bias: string
  last_move: string
  next_meeting: string
  source_url: string
  updated_at: string
}

const tagOptions = ['Module 1', 'Module 2', 'Module 3', 'Marktanalyse', 'Psychologie', 'Risicomanagement', 'Strategie', 'Data']

const iconOptions = [
  { value: 'shield', label: 'Schild' },
  { value: 'smile', label: 'Psychologie' },
  { value: 'activity', label: 'Grafiek' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'settings', label: 'Tandwiel' },
  { value: 'lock', label: 'Slot' },
  { value: 'book', label: 'Boek' },
  { value: 'star', label: 'Ster' },
  { value: 'trending-up', label: 'Trend' },
  { value: 'bar-chart', label: 'Grafiek staaf' },
]

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext || '')) return '📄'
  if (['doc', 'docx'].includes(ext || '')) return '📝'
  if (['xls', 'xlsx'].includes(ext || '')) return '📊'
  if (['ppt', 'pptx'].includes(ext || '')) return '📑'
  if (['zip', 'rar'].includes(ext || '')) return '🗜️'
  return '📎'
}

export default function AdminPage() {
  const [tab, setTab] = useState<'articles' | 'kennisbank' | 'categories' | 'users' | 'tools' | 'rentes'>('articles')
  const [articles, setArticles] = useState<Article[]>([])
  const [kennisbankItems, setKennisbankItems] = useState<KennisbankItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [tools, setTools] = useState<ToolSetting[]>([])
  const [cbRates, setCbRates] = useState<CentralBankRate[]>([])
  const [editingCb, setEditingCb] = useState<CentralBankRate | null>(null)
  const [editing, setEditing] = useState<Article | null>(null)
  const [editingKb, setEditingKb] = useState<KennisbankItem | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingDocs, setUploadingDocs] = useState(false)

  // Move modal state
  const [moveModal, setMoveModal] = useState<{
    type: 'articleToKb' | 'kbToArticle'
    item: Article | KennisbankItem
    selectedCategory?: string
  } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // All writes go through the admin API route (uses service role key → bypasses RLS)
  const adminWrite = async (action: string, table: string, data?: object, id?: string) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data, id }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Opslaan mislukt')
    }
    return res.json()
  }

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }

    const [{ data: arts }, { data: kbs }, { data: cats }, { data: profs }, { data: tls }, { data: cbr }] = await Promise.all([
      supabase.from('articles').select('*').order('created_at', { ascending: false }),
      supabase.from('kennisbank_items').select('*').order('category').order('order_index'),
      supabase.from('kennisbank_categories').select('*').order('order_index'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('tool_settings').select('*').order('created_at'),
      supabase.from('central_bank_rates').select('*').order('currency'),
    ])

    if (arts) setArticles(arts)
    if (kbs) setKennisbankItems(kbs)
    if (cats) setCategories(cats)
    if (profs) setUsers(profs)
    if (tls) setTools(tls)
    if (cbr) setCbRates(cbr)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  // ─── ARTICLES ─────────────────────────────────────────────
  const newArticle = (): Article => ({
    id: '', title: '', slug: '', excerpt: '', content: '', tag: '',
    is_premium: false, published: false, reading_time: 5, created_at: new Date().toISOString(),
  })

  const saveArticle = async () => {
    if (!editing) return
    const { id, created_at, ...data } = editing
    let slug = data.slug || generateSlug(data.title)
    try {
      if (id) {
        await adminWrite('update', 'articles', { ...data, slug, updated_at: new Date().toISOString() }, id)
      } else {
        try {
          await adminWrite('insert', 'articles', { ...data, slug })
        } catch (_e) {
          slug = slug + '-' + Date.now().toString(36)
          await adminWrite('insert', 'articles', { ...data, slug })
        }
      }
      setEditing(null)
      loadData()
    } catch (e) {
      alert('Fout bij opslaan: ' + (e as Error).message)
    }
  }

  const deleteArticle = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) return
    try {
      await adminWrite('delete', 'articles', undefined, id)
      loadData()
    } catch (e) {
      alert('Fout bij verwijderen: ' + (e as Error).message)
    }
  }

  // ─── KENNISBANK ITEMS ──────────────────────────────────────
  const newKbItem = (): KennisbankItem => ({
    id: '', title: '', slug: '', content: '',
    category: categories[0]?.slug || 'risicomanagement',
    is_premium: false, order_index: 0, documents: [],
  })

  const saveKbItem = async () => {
    if (!editingKb) return
    const { id, ...data } = editingKb
    let slug = data.slug || generateSlug(data.title)
    try {
      if (id) {
        await adminWrite('update', 'kennisbank_items', { ...data, slug }, id)
      } else {
        // Als slug al bestaat, voeg uniek suffix toe
        try {
          await adminWrite('insert', 'kennisbank_items', { ...data, slug })
        } catch (_e) {
          slug = slug + '-' + Date.now().toString(36)
          await adminWrite('insert', 'kennisbank_items', { ...data, slug })
        }
      }
      setEditingKb(null)
      loadData()
    } catch (e) {
      alert('Fout bij opslaan: ' + (e as Error).message)
    }
  }

  const deleteKbItem = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return
    try {
      await adminWrite('delete', 'kennisbank_items', undefined, id)
      loadData()
    } catch (e) {
      alert('Fout bij verwijderen: ' + (e as Error).message)
    }
  }

  // ─── DOCUMENT UPLOAD ───────────────────────────────────────
  const uploadDocument = async (file: File) => {
    if (!editingKb) return
    setUploadingDocs(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `kb-docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('documents').upload(fileName, file)
      if (error) {
        // Try images bucket as fallback
        const { error: err2 } = await supabase.storage.from('images').upload(fileName, file)
        if (err2) { alert('Upload mislukt: ' + (err2.message || error.message)); return }
        const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
        const doc: KennisbankDocument = { name: file.name, url: urlData.publicUrl, size: file.size }
        setEditingKb({ ...editingKb, documents: [...(editingKb.documents || []), doc] })
      } else {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)
        const doc: KennisbankDocument = { name: file.name, url: urlData.publicUrl, size: file.size }
        setEditingKb({ ...editingKb, documents: [...(editingKb.documents || []), doc] })
      }
    } finally {
      setUploadingDocs(false)
    }
  }

  const removeDocument = (index: number) => {
    if (!editingKb) return
    const docs = [...(editingKb.documents || [])]
    docs.splice(index, 1)
    setEditingKb({ ...editingKb, documents: docs })
  }

  // ─── MOVE ARTICLE → KENNISBANK ─────────────────────────────
  const confirmMoveToKb = async () => {
    if (!moveModal || moveModal.type !== 'articleToKb') return
    const art = moveModal.item as Article
    const category = moveModal.selectedCategory || categories[0]?.slug
    if (!category) return
    try {
      await adminWrite('insert', 'kennisbank_items', {
        title: art.title,
        slug: art.slug || generateSlug(art.title),
        content: art.content,
        category,
        is_premium: art.is_premium,
        order_index: 0,
        documents: [],
      })
      await adminWrite('delete', 'articles', undefined, art.id)
      setMoveModal(null)
      loadData()
    } catch (e) {
      alert('Fout bij verplaatsen: ' + (e as Error).message)
    }
  }

  // ─── MOVE KENNISBANK → ARTICLE ─────────────────────────────
  const confirmMoveToArticle = async () => {
    if (!moveModal || moveModal.type !== 'kbToArticle') return
    const kb = moveModal.item as KennisbankItem
    try {
      await adminWrite('insert', 'articles', {
        title: kb.title,
        slug: kb.slug || generateSlug(kb.title),
        content: kb.content,
        excerpt: '',
        tag: '',
        is_premium: kb.is_premium,
        published: false,
        reading_time: 5,
      })
      await adminWrite('delete', 'kennisbank_items', undefined, kb.id)
      setMoveModal(null)
      loadData()
    } catch (e) {
      alert('Fout bij verplaatsen: ' + (e as Error).message)
    }
  }

  // ─── CATEGORIES ────────────────────────────────────────────
  const newCategory = (): Category => ({
    id: '', name: '', slug: '', icon: 'shield',
    is_premium: false, order_index: categories.length + 1,
  })

  const saveCategory = async () => {
    if (!editingCat) return
    const { id, ...data } = editingCat
    const slug = data.slug || generateSlug(data.name)
    try {
      if (id) {
        await adminWrite('update', 'kennisbank_categories', { ...data, slug }, id)
      } else {
        await adminWrite('insert', 'kennisbank_categories', { ...data, slug })
      }
      setEditingCat(null)
      loadData()
    } catch (e) {
      alert('Fout bij opslaan: ' + (e as Error).message)
    }
  }

  const deleteCategory = async (id: string, slug: string) => {
    const hasItems = kennisbankItems.some((i) => i.category === slug)
    if (hasItems) { alert('Deze categorie heeft nog items. Verwijder of verplaats die eerst.'); return }
    if (!confirm('Weet je zeker dat je deze categorie wilt verwijderen?')) return
    try {
      await adminWrite('delete', 'kennisbank_categories', undefined, id)
      loadData()
    } catch (e) {
      alert('Fout bij verwijderen: ' + (e as Error).message)
    }
  }

  const toggleCategoryPremium = async (cat: Category) => {
    try {
      await adminWrite('update', 'kennisbank_categories', { is_premium: !cat.is_premium }, cat.id)
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, is_premium: !c.is_premium } : c))
    } catch (e) {
      alert('Fout: ' + (e as Error).message)
    }
  }

  // ─── USERS ─────────────────────────────────────────────────
  const changeUserRole = async (userId: string, newRole: 'free' | 'premium' | 'admin') => {
    if (newRole === 'admin' && !confirm('Weet je zeker dat je deze gebruiker admin rechten wilt geven?')) return
    try {
      await adminWrite('update', 'profiles', { role: newRole }, userId)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    } catch (e) {
      alert('Fout: ' + (e as Error).message)
    }
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

      {/* MOVE MODAL */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-elevated rounded-2xl p-6 w-full max-w-md mx-4">
            {moveModal.type === 'articleToKb' && (
              <>
                <h3 className="text-lg font-display font-semibold text-heading mb-2">Verplaats naar Kennisbank</h3>
                <p className="text-sm text-text-muted mb-4">
                  Kies een categorie voor <strong className="text-heading">"{(moveModal.item as Article).title}"</strong>.
                  Het artikel wordt verwijderd uit Artikelen.
                </p>
                <label className="block text-sm text-text-muted mb-1">Categorie</label>
                <select
                  value={moveModal.selectedCategory || categories[0]?.slug}
                  onChange={(e) => setMoveModal({ ...moveModal, selectedCategory: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-bg border border-border text-heading text-sm mb-4 focus:outline-none focus:border-accent"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setMoveModal(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
                  <button onClick={confirmMoveToKb} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">Verplaatsen</button>
                </div>
              </>
            )}
            {moveModal.type === 'kbToArticle' && (
              <>
                <h3 className="text-lg font-display font-semibold text-heading mb-2">Verplaats naar Artikelen</h3>
                <p className="text-sm text-text-muted mb-4">
                  <strong className="text-heading">"{(moveModal.item as KennisbankItem).title}"</strong> wordt
                  verplaatst naar Artikelen als concept. Je kunt daarna tag, leestijd en excerpt instellen.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setMoveModal(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
                  <button onClick={confirmMoveToArticle} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">Verplaatsen</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-display font-semibold text-heading">Admin Panel</h1>
        <div className="flex gap-2 flex-wrap">
          {(['articles', 'kennisbank', 'categories', 'users', 'tools', 'rentes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditing(null); setEditingKb(null); setEditingCat(null); setEditingCb(null) }}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                tab === t ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
              }`}
            >
              {t === 'articles' ? 'Artikelen' : t === 'kennisbank' ? 'Kennisbank' : t === 'categories' ? 'Categorieën' : t === 'users' ? 'Gebruikers' : t === 'tools' ? 'Tools' : 'Rentes'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ARTICLES TAB — LIST
      ═══════════════════════════════════════════════════════ */}
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
              <div key={a.id} className="flex items-center justify-between p-4 rounded-xl glass">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-heading truncate">{a.title}</h3>
                    {a.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold shrink-0">Premium</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dim">
                    <span className={a.published ? 'text-green-400' : 'text-amber-400'}>{a.published ? 'Gepubliceerd' : 'Concept'}</span>
                    {a.tag && <span>{a.tag}</span>}
                    <span>{a.reading_time} min</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
                  <button
                    onClick={() => setMoveModal({ type: 'articleToKb', item: a, selectedCategory: categories[0]?.slug })}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                    title="Verplaats naar Kennisbank"
                  >
                    → Kennisbank
                  </button>
                  <button onClick={() => setEditing(a)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors">
                    Bewerken
                  </button>
                  <button onClick={() => deleteArticle(a.id)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          ARTICLES TAB — EDITOR
      ═══════════════════════════════════════════════════════ */}
      {tab === 'articles' && editing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">{editing.id ? 'Artikel bewerken' : 'Nieuw artikel'}</h2>
            <button onClick={() => setEditing(null)} className="text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Titel</label>
            <input type="text" value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Slug</label>
            <input type="text" value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-text-muted text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Tag</label>
              <select value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent">
                <option value="">Geen tag</option>
                {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Leestijd (min)</label>
              <input type="number" value={editing.reading_time}
                onChange={(e) => setEditing({ ...editing, reading_time: parseInt(e.target.value) || 5 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Excerpt</label>
            <textarea rows={2} value={editing.excerpt}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Afbeeldingen uploaden</label>
            <input type="file" accept="image/*" multiple
              onChange={async (e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                const links: string[] = []
                for (const file of Array.from(files)) {
                  const ext = file.name.split('.').pop()
                  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                  const { error } = await supabase.storage.from('images').upload(fileName, file)
                  if (error) { alert(`Upload mislukt: ${file.name}`); continue }
                  const { data: u } = supabase.storage.from('images').getPublicUrl(fileName)
                  links.push(`<img src="${u.publicUrl}" alt="${file.name}" />`)
                }
                if (links.length > 0) {
                  await navigator.clipboard.writeText(links.join('\n'))
                  alert(`${links.length} afbeelding(en) geüpload en gekopieerd naar klembord.`)
                }
                e.target.value = ''
              }}
              className="text-sm text-text-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-border file:bg-bg-card file:text-text-muted file:text-sm file:cursor-pointer hover:file:text-heading file:transition-colors"
            />
            <p className="text-xs text-text-dim mt-1">Meerdere tegelijk selecteren → HTML img-tags worden gekopieerd naar klembord</p>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Content</label>
            <RichEditor value={editing.content} onChange={(html) => setEditing({ ...editing, content: html })} supabase={supabase} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input type="checkbox" checked={editing.is_premium} onChange={(e) => setEditing({ ...editing, is_premium: e.target.checked })} className="rounded border-border" />
              Premium
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} className="rounded border-border" />
              Gepubliceerd
            </label>
          </div>
          <button onClick={saveArticle} className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">
            Opslaan
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          KENNISBANK TAB — LIST
      ═══════════════════════════════════════════════════════ */}
      {tab === 'kennisbank' && !editingKb && (
        <>
          <button onClick={() => setEditingKb(newKbItem())} className="mb-6 px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">
            + Nieuw item
          </button>
          {categories.map((cat) => {
            const catItems = kennisbankItems.filter((i) => i.category === cat.slug)
            return (
              <div key={cat.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-heading">{cat.name}</h3>
                  {cat.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold">Premium</span>}
                  <span className="text-xs text-text-dim">{catItems.length} items</span>
                </div>
                {catItems.length === 0 ? (
                  <p className="text-xs text-text-dim pl-1">Geen items</p>
                ) : (
                  <div className="space-y-2">
                    {catItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-text truncate">{item.title}</span>
                          {item.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold shrink-0">Premium</span>}
                          {(item.documents?.length ?? 0) > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-light shrink-0">
                              {item.documents!.length} doc{item.documents!.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
                          <button
                            onClick={() => setMoveModal({ type: 'kbToArticle', item })}
                            className="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                            title="Verplaats naar Artikelen"
                          >
                            → Artikel
                          </button>
                          <button onClick={() => setEditingKb({ ...item, documents: item.documents || [] })} className="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors">
                            Bewerken
                          </button>
                          <button onClick={() => deleteKbItem(item.id)} className="px-3 py-1 rounded-lg border border-border text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                            Verwijderen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          KENNISBANK TAB — EDITOR
      ═══════════════════════════════════════════════════════ */}
      {tab === 'kennisbank' && editingKb && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">{editingKb.id ? 'Item bewerken' : 'Nieuw item'}</h2>
            <button onClick={() => setEditingKb(null)} className="text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Titel</label>
            <input type="text" value={editingKb.title}
              onChange={(e) => setEditingKb({ ...editingKb, title: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Categorie</label>
              <select value={editingKb.category} onChange={(e) => setEditingKb({ ...editingKb, category: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent">
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Volgorde</label>
              <input type="number" value={editingKb.order_index}
                onChange={(e) => setEditingKb({ ...editingKb, order_index: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Afbeeldingen uploaden</label>
            <input type="file" accept="image/*" multiple
              onChange={async (e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                const links: string[] = []
                for (const file of Array.from(files)) {
                  const ext = file.name.split('.').pop()
                  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                  const { error } = await supabase.storage.from('images').upload(fileName, file)
                  if (error) { alert(`Upload mislukt: ${file.name}`); continue }
                  const { data: u } = supabase.storage.from('images').getPublicUrl(fileName)
                  links.push(`<img src="${u.publicUrl}" alt="${file.name}" />`)
                }
                if (links.length > 0) {
                  await navigator.clipboard.writeText(links.join('\n'))
                  alert(`${links.length} afbeelding(en) geüpload en gekopieerd naar klembord.`)
                }
                e.target.value = ''
              }}
              className="text-sm text-text-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-border file:bg-bg-card file:text-text-muted file:text-sm file:cursor-pointer hover:file:text-heading file:transition-colors"
            />
            <p className="text-xs text-text-dim mt-1">Meerdere tegelijk selecteren → HTML img-tags worden gekopieerd naar klembord</p>
          </div>

          {/* Rich editor */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Content</label>
            <RichEditor value={editingKb.content} onChange={(html) => setEditingKb({ ...editingKb, content: html })} supabase={supabase} />
          </div>

          {/* Document upload */}
          <div>
            <label className="block text-sm text-text-muted mb-2">Documenten (downloadbaar voor lezers)</label>

            {/* Existing docs list */}
            {(editingKb.documents || []).length > 0 && (
              <div className="space-y-2 mb-3">
                {(editingKb.documents || []).map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{getFileIcon(doc.name)}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-heading truncate">{doc.name}</p>
                        <p className="text-xs text-text-dim">{formatFileSize(doc.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-light hover:underline">Preview</a>
                      <button onClick={() => removeDocument(i)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Verwijderen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new doc */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
                multiple
                disabled={uploadingDocs}
                onChange={async (e) => {
                  const files = e.target.files
                  if (!files || files.length === 0) return
                  for (const file of Array.from(files)) {
                    await uploadDocument(file)
                  }
                  e.target.value = ''
                }}
                className="text-sm text-text-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-border file:bg-bg-card file:text-text-muted file:text-sm file:cursor-pointer hover:file:text-heading file:transition-colors disabled:opacity-50"
              />
              {uploadingDocs && <span className="text-xs text-text-dim animate-pulse">Uploaden...</span>}
            </div>
            <p className="text-xs text-text-dim mt-1">PDF, Word, Excel, PowerPoint, ZIP — lezers kunnen deze downloaden op de pagina</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input type="checkbox" checked={editingKb.is_premium} onChange={(e) => setEditingKb({ ...editingKb, is_premium: e.target.checked })} className="rounded border-border" />
            Premium
          </label>

          <button onClick={saveKbItem} className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">
            Opslaan
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CATEGORIES TAB — LIST
      ═══════════════════════════════════════════════════════ */}
      {tab === 'categories' && !editingCat && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-muted">Schakel premium in per categorie — bezoekers zien dan "Ontdek Premium" met een slot.</p>
            <button onClick={() => setEditingCat(newCategory())} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors shrink-0 ml-4">
              + Nieuwe categorie
            </button>
          </div>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl glass">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-text-dim text-xs w-5 text-right shrink-0">{cat.order_index}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-heading">{cat.name}</span>
                      <span className="text-xs text-text-dim">/{cat.slug}</span>
                    </div>
                    <span className="text-xs text-text-dim">{kennisbankItems.filter((i) => i.category === cat.slug).length} items</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button onClick={() => toggleCategoryPremium(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${cat.is_premium ? 'border-gold/40 bg-gold-dim text-gold hover:bg-gold/20' : 'border-border text-text-muted hover:text-heading'}`}>
                    {cat.is_premium ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>Premium</>
                    ) : 'Gratis'}
                  </button>
                  <button onClick={() => setEditingCat(cat)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors">Bewerken</button>
                  <button onClick={() => deleteCategory(cat.id, cat.slug)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-red-400 hover:bg-red-400/10 transition-colors">Verwijderen</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          CATEGORIES TAB — EDITOR
      ═══════════════════════════════════════════════════════ */}
      {tab === 'categories' && editingCat && (
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">{editingCat.id ? 'Categorie bewerken' : 'Nieuwe categorie'}</h2>
            <button onClick={() => setEditingCat(null)} className="text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Naam</label>
            <input type="text" value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              placeholder="bijv. Technische Analyse"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Slug</label>
            <input type="text" value={editingCat.slug}
              onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-text-muted text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Icoon</label>
              <select value={editingCat.icon} onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent">
                {iconOptions.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Volgorde</label>
              <input type="number" value={editingCat.order_index}
                onChange={(e) => setEditingCat({ ...editingCat, order_index: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input type="checkbox" checked={editingCat.is_premium} onChange={(e) => setEditingCat({ ...editingCat, is_premium: e.target.checked })} className="rounded border-border" />
            Premium categorie (toont "Ontdek Premium" overlay op kennisbank)
          </label>
          <button onClick={saveCategory} className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">Opslaan</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          USERS TAB
      ═══════════════════════════════════════════════════════ */}
      {tab === 'users' && (
        <>
          <div className="mb-6">
            <p className="text-sm text-text-muted">Beheer gebruikersrollen. Premium leden kunnen premium artikelen en kennisbank items zien.</p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-text-dim" />Free: {users.filter(u => u.role === 'free').length}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold" />Premium: {users.filter(u => u.role === 'premium').length}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" />Admin: {users.filter(u => u.role === 'admin').length}</span>
              <span className="text-text-dim">Totaal: {users.length}</span>
            </div>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 rounded-xl glass">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-heading truncate">{user.full_name || 'Geen naam'}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${user.role === 'admin' ? 'bg-accent/20 text-accent-light' : user.role === 'premium' ? 'bg-gold-dim text-gold' : 'bg-bg-hover text-text-dim'}`}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dim">
                    <span>{user.email}</span>
                    <span>Lid sinds {new Date(user.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  {user.role === 'free' && (
                    <button onClick={() => changeUserRole(user.id, 'premium')} className="px-3 py-1.5 rounded-lg border border-gold/40 bg-gold-dim text-xs text-gold font-medium hover:bg-gold/20 transition-colors">Maak Premium</button>
                  )}
                  {user.role === 'premium' && (
                    <>
                      <button onClick={() => changeUserRole(user.id, 'free')} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors">Terug naar Free</button>
                      <button onClick={() => changeUserRole(user.id, 'admin')} className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-xs text-accent-light font-medium hover:bg-accent/20 transition-colors">Maak Admin</button>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <button onClick={() => changeUserRole(user.id, 'premium')} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors">Verwijder Admin</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TOOLS TAB
      ═══════════════════════════════════════════════════════ */}
      {tab === 'tools' && (
        <>
          <div className="mb-6">
            <p className="text-sm text-text-muted">Bepaal welke tools premium zijn. Free gebruikers zien een lock-scherm bij premium tools.</p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-text-dim" />Gratis: {tools.filter(t => !t.is_premium).length}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold" />Premium: {tools.filter(t => t.is_premium).length}</span>
              <span className="text-text-dim">Totaal: {tools.length}</span>
            </div>
          </div>
          <div className="space-y-3">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between p-4 rounded-xl glass">
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-heading">{tool.name}</span>
                      <span className="text-xs text-text-dim">/{tool.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    onClick={async () => {
                      try {
                        await adminWrite('update', 'tool_settings', { is_premium: !tool.is_premium }, tool.id)
                        setTools((prev) => prev.map((t) => t.id === tool.id ? { ...t, is_premium: !t.is_premium } : t))
                      } catch (e) {
                        alert('Fout: ' + (e as Error).message)
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      tool.is_premium
                        ? 'border-gold/40 bg-gold-dim text-gold hover:bg-gold/20'
                        : 'border-border text-text-muted hover:text-heading'
                    }`}
                  >
                    {tool.is_premium ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Premium
                      </>
                    ) : 'Gratis'}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await adminWrite('update', 'tool_settings', { visible: !tool.visible }, tool.id)
                        setTools((prev) => prev.map((t) => t.id === tool.id ? { ...t, visible: !t.visible } : t))
                      } catch (e) {
                        alert('Fout: ' + (e as Error).message)
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      tool.visible
                        ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                        : 'border-border text-text-dim hover:text-text-muted'
                    }`}
                  >
                    {tool.visible ? 'Zichtbaar' : 'Verborgen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {tools.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-text-dim">Geen tools gevonden. Voer de tool_settings SQL uit in Supabase.</p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          RENTES TAB
      ═══════════════════════════════════════════════════════ */}
      {tab === 'rentes' && (
        <>
          {editingCb ? (
            /* ── Edit form ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-heading">
                  {editingCb.currency ? `${editingCb.currency} — ${editingCb.bank}` : 'Nieuwe centrale bank'}
                </h2>
                <button onClick={() => setEditingCb(null)} className="text-sm text-text-muted hover:text-heading">Annuleren</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Valuta code</label>
                  <input value={editingCb.currency} onChange={e => setEditingCb({ ...editingCb, currency: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="USD" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Land</label>
                  <input value={editingCb.country} onChange={e => setEditingCb({ ...editingCb, country: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="Verenigde Staten" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Centrale bank naam</label>
                  <input value={editingCb.bank} onChange={e => setEditingCb({ ...editingCb, bank: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="Federal Reserve (Fed)" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Huidige rente (%)</label>
                  <input type="number" step="0.01" value={editingCb.rate ?? ''} onChange={e => setEditingCb({ ...editingCb, rate: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="3.75" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Target rente (%)</label>
                  <input type="number" step="0.01" value={editingCb.target ?? ''} onChange={e => setEditingCb({ ...editingCb, target: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="3.50" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vlag (landcode)</label>
                  <input value={editingCb.flag} onChange={e => setEditingCb({ ...editingCb, flag: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="US" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Bias</label>
                  <select value={editingCb.bias} onChange={e => setEditingCb({ ...editingCb, bias: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm">
                    <option value="">Geen</option>
                    <option value="afwachtend">Afwachtend</option>
                    <option value="voorzichtig verruimend">Voorzichtig verruimend</option>
                    <option value="verruimend">Verruimend</option>
                    <option value="voorzichtig verkrappend">Voorzichtig verkrappend</option>
                    <option value="verkrappend">Verkrappend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Laatste actie</label>
                  <input value={editingCb.last_move} onChange={e => setEditingCb({ ...editingCb, last_move: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="25bp knip (januari 2026)" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Volgende vergadering</label>
                  <input value={editingCb.next_meeting} onChange={e => setEditingCb({ ...editingCb, next_meeting: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="6 mei 2026" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Bron URL</label>
                  <input value={editingCb.source_url} onChange={e => setEditingCb({ ...editingCb, source_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-heading text-sm" placeholder="https://www.federalreserve.gov/monetarypolicy.htm" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const payload = {
                        currency: editingCb.currency,
                        country: editingCb.country,
                        bank: editingCb.bank,
                        rate: editingCb.rate,
                        target: editingCb.target,
                        flag: editingCb.flag,
                        bias: editingCb.bias,
                        last_move: editingCb.last_move,
                        next_meeting: editingCb.next_meeting,
                        source_url: editingCb.source_url,
                        updated_at: new Date().toISOString(),
                      }
                      if (editingCb.id) {
                        await adminWrite('update', 'central_bank_rates', payload, editingCb.id)
                        setCbRates(prev => prev.map(r => r.id === editingCb.id ? { ...r, ...payload } : r))
                      } else {
                        const res = await adminWrite('insert', 'central_bank_rates', payload)
                        setCbRates(prev => [...prev, res.data])
                      }
                      setEditingCb(null)
                    } catch (e) {
                      alert('Fout: ' + (e as Error).message)
                    }
                  }}
                  className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
                >
                  Opslaan
                </button>
                <button onClick={() => setEditingCb(null)} className="px-5 py-2 rounded-lg border border-border text-text-muted text-sm hover:text-heading transition-colors">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            /* ── List view ── */
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-text-muted">Beheer rentetarieven van centrale banken. Wijzigingen zijn direct zichtbaar op de rentetarieven pagina.</p>
                  <p className="text-xs text-text-dim mt-1">{cbRates.length} centrale banken</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/rates/meetings')
                        const json = await res.json()
                        if (!json.meetings || Object.keys(json.meetings).length === 0) {
                          alert('Geen aankomende vergaderingen gevonden in de kalender.')
                          return
                        }
                        let updated = 0
                        for (const [ccy, meeting] of Object.entries(json.meetings as Record<string, { date: string; title: string }>)) {
                          const existing = cbRates.find(r => r.currency === ccy)
                          if (existing && meeting.date) {
                            await adminWrite('update', 'central_bank_rates', { next_meeting: meeting.date, updated_at: new Date().toISOString() }, existing.id)
                            setCbRates(prev => prev.map(r => r.currency === ccy ? { ...r, next_meeting: meeting.date } : r))
                            updated++
                          }
                        }
                        alert(`${updated} vergaderdata bijgewerkt vanuit economische kalender.`)
                      } catch (e) {
                        alert('Fout bij ophalen: ' + (e as Error).message)
                      }
                    }}
                    className="px-4 py-2 rounded-lg border border-accent/40 text-accent text-sm font-medium hover:bg-accent/10 transition-colors flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Vergaderingen ophalen
                  </button>
                  <button
                    onClick={() => setEditingCb({ id: '', currency: '', country: '', bank: '', rate: null, target: null, flag: '', bias: '', last_move: '', next_meeting: '', source_url: '', updated_at: '' })}
                    className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
                  >
                    + Toevoegen
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {cbRates.map((cb) => {
                  const diff = cb.rate !== null && cb.target !== null ? cb.rate - cb.target : null
                  return (
                    <div key={cb.id} className="flex items-center justify-between p-4 rounded-xl glass gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xl shrink-0">
                          {cb.flag ? cb.flag.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('') : '🏳️'}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-heading">{cb.currency}</span>
                            <span className="text-xs text-text-dim">{cb.country}</span>
                          </div>
                          <p className="text-xs text-text-muted truncate">{cb.bank}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-heading">{cb.rate !== null ? `${cb.rate}%` : '—'}</p>
                          <p className="text-[10px] text-text-dim">
                            target: {cb.target !== null ? `${cb.target}%` : '—'}
                            {diff !== null && diff !== 0 && (
                              <span className={diff > 0 ? ' text-amber-400' : ' text-blue-400'}>
                                {' '}({diff > 0 ? '+' : ''}{diff.toFixed(2)}%)
                              </span>
                            )}
                          </p>
                        </div>
                        {cb.bias && (
                          <span className={`text-[10px] px-2 py-0.5 rounded border hidden sm:inline-block ${
                            cb.bias.includes('verkrappend') ? 'border-green-500/20 text-green-400 bg-green-500/10' :
                            cb.bias.includes('verruimend') ? 'border-red-500/20 text-red-400 bg-red-500/10' :
                            'border-border text-text-dim'
                          }`}>{cb.bias}</span>
                        )}
                        {cb.next_meeting && (
                          <span className="text-[10px] text-text-dim hidden md:block">Vergadering: {cb.next_meeting}</span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingCb(cb)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                          >
                            Bewerken
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`${cb.currency} (${cb.country}) verwijderen?`)) return
                              try {
                                await adminWrite('delete', 'central_bank_rates', undefined, cb.id)
                                setCbRates(prev => prev.filter(r => r.id !== cb.id))
                              } catch (e) {
                                alert('Fout: ' + (e as Error).message)
                              }
                            }}
                            className="px-2 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {cbRates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-text-dim">Geen centrale banken gevonden. Voer de central_bank_rates SQL uit in Supabase of voeg er een toe.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
