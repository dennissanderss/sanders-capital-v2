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

export default function AdminPage() {
  const [tab, setTab] = useState<'articles' | 'kennisbank' | 'categories' | 'users'>('articles')
  const [articles, setArticles] = useState<Article[]>([])
  const [kennisbankItems, setKennisbankItems] = useState<KennisbankItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [editing, setEditing] = useState<Article | null>(null)
  const [editingKb, setEditingKb] = useState<KennisbankItem | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
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

    const [{ data: arts }, { data: kbs }, { data: cats }, { data: profs }] = await Promise.all([
      supabase.from('articles').select('*').order('created_at', { ascending: false }),
      supabase.from('kennisbank_items').select('*').order('category').order('order_index'),
      supabase.from('kennisbank_categories').select('*').order('order_index'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ])

    if (arts) setArticles(arts)
    if (kbs) setKennisbankItems(kbs)
    if (cats) setCategories(cats)
    if (profs) setUsers(profs)
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
    category: categories[0]?.slug || 'risicomanagement',
    is_premium: false,
    order_index: 0,
  })

  const newCategory = (): Category => ({
    id: '',
    name: '',
    slug: '',
    icon: 'shield',
    is_premium: false,
    order_index: categories.length + 1,
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

  const saveCategory = async () => {
    if (!editingCat) return
    const { id, ...data } = editingCat
    const slug = data.slug || generateSlug(data.name)

    if (id) {
      await supabase.from('kennisbank_categories').update({ ...data, slug }).eq('id', id)
    } else {
      await supabase.from('kennisbank_categories').insert({ ...data, slug })
    }
    setEditingCat(null)
    loadData()
  }

  const deleteCategory = async (id: string, slug: string) => {
    const hasItems = kennisbankItems.some((i) => i.category === slug)
    if (hasItems) {
      alert('Deze categorie heeft nog items. Verwijder of verplaats die eerst.')
      return
    }
    if (!confirm('Weet je zeker dat je deze categorie wilt verwijderen?')) return
    await supabase.from('kennisbank_categories').delete().eq('id', id)
    loadData()
  }

  const changeUserRole = async (userId: string, newRole: 'free' | 'premium' | 'admin') => {
    if (newRole === 'admin' && !confirm('Weet je zeker dat je deze gebruiker admin rechten wilt geven?')) return
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
  }

  const toggleCategoryPremium = async (cat: Category) => {
    await supabase.from('kennisbank_categories').update({ is_premium: !cat.is_premium }).eq('id', cat.id)
    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, is_premium: !c.is_premium } : c))
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
            onClick={() => { setTab('articles'); setEditing(null); setEditingKb(null); setEditingCat(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'articles' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Artikelen
          </button>
          <button
            onClick={() => { setTab('kennisbank'); setEditing(null); setEditingKb(null); setEditingCat(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'kennisbank' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Kennisbank
          </button>
          <button
            onClick={() => { setTab('categories'); setEditing(null); setEditingKb(null); setEditingCat(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'categories' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Categorieën
          </button>
          <button
            onClick={() => { setTab('users'); setEditing(null); setEditingKb(null); setEditingCat(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === 'users' ? 'bg-accent text-white' : 'bg-bg-card border border-border text-text-muted hover:text-heading'
            }`}
          >
            Gebruikers
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

          {categories.map((cat) => {
            const catItems = kennisbankItems.filter((i) => i.category === cat.slug)
            if (catItems.length === 0) return (
              <div key={cat.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-heading">{cat.name}</h3>
                  {cat.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold">Premium</span>}
                </div>
                <p className="text-xs text-text-dim pl-1">Geen items</p>
              </div>
            )
            return (
              <div key={cat.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-heading">{cat.name}</h3>
                  {cat.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-dim text-gold">Premium</span>}
                </div>
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
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
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

      {/* CATEGORIES TAB */}
      {tab === 'categories' && !editingCat && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-muted">
              Schakel premium in per categorie — bezoekers zien dan "Ontdek Premium" met een slot.
            </p>
            <button
              onClick={() => setEditingCat(newCategory())}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors shrink-0 ml-4"
            >
              + Nieuwe categorie
            </button>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-4 rounded-xl bg-bg-card border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-text-dim text-xs w-5 text-right shrink-0">{cat.order_index}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-heading">{cat.name}</span>
                      <span className="text-xs text-text-dim">/{cat.slug}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-dim">{kennisbankItems.filter((i) => i.category === cat.slug).length} items</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {/* Premium toggle */}
                  <button
                    onClick={() => toggleCategoryPremium(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      cat.is_premium
                        ? 'border-gold/40 bg-gold-dim text-gold hover:bg-gold/20'
                        : 'border-border text-text-muted hover:text-heading'
                    }`}
                  >
                    {cat.is_premium ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Premium
                      </>
                    ) : (
                      'Gratis'
                    )}
                  </button>

                  <button
                    onClick={() => setEditingCat(cat)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id, cat.slug)}
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

      {/* USERS TAB */}
      {tab === 'users' && (
        <>
          <div className="mb-6">
            <p className="text-sm text-text-muted">
              Beheer gebruikersrollen. Premium leden kunnen premium artikelen en kennisbank items zien.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-text-dim" />
                Free: {users.filter(u => u.role === 'free').length}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold" />
                Premium: {users.filter(u => u.role === 'premium').length}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Admin: {users.filter(u => u.role === 'admin').length}
              </span>
              <span className="text-text-dim">
                Totaal: {users.length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-xl bg-bg-card border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-heading truncate">
                      {user.full_name || 'Geen naam'}
                    </h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      user.role === 'admin'
                        ? 'bg-accent/20 text-accent-light'
                        : user.role === 'premium'
                        ? 'bg-gold-dim text-gold'
                        : 'bg-bg-hover text-text-dim'
                    }`}>
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
                    <button
                      onClick={() => changeUserRole(user.id, 'premium')}
                      className="px-3 py-1.5 rounded-lg border border-gold/40 bg-gold-dim text-xs text-gold font-medium hover:bg-gold/20 transition-colors"
                    >
                      Maak Premium
                    </button>
                  )}
                  {user.role === 'premium' && (
                    <>
                      <button
                        onClick={() => changeUserRole(user.id, 'free')}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                      >
                        Terug naar Free
                      </button>
                      <button
                        onClick={() => changeUserRole(user.id, 'admin')}
                        className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-xs text-accent-light font-medium hover:bg-accent/20 transition-colors"
                      >
                        Maak Admin
                      </button>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <button
                      onClick={() => changeUserRole(user.id, 'premium')}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading transition-colors"
                    >
                      Verwijder Admin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* CATEGORY EDITOR */}
      {tab === 'categories' && editingCat && (
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-heading">
              {editingCat.id ? 'Categorie bewerken' : 'Nieuwe categorie'}
            </h2>
            <button
              onClick={() => setEditingCat(null)}
              className="text-sm text-text-muted hover:text-heading transition-colors"
            >
              Annuleren
            </button>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Naam</label>
            <input
              type="text"
              value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value, slug: generateSlug(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              placeholder="bijv. Technische Analyse"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Slug</label>
            <input
              type="text"
              value={editingCat.slug}
              onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-text-muted text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Icoon</label>
              <select
                value={editingCat.icon}
                onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              >
                {iconOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Volgorde</label>
              <input
                type="number"
                value={editingCat.order_index}
                onChange={(e) => setEditingCat({ ...editingCat, order_index: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editingCat.is_premium}
              onChange={(e) => setEditingCat({ ...editingCat, is_premium: e.target.checked })}
              className="rounded border-border"
            />
            Premium categorie (toont "Ontdek Premium" overlay op kennisbank)
          </label>

          <button
            onClick={saveCategory}
            className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            Opslaan
          </button>
        </div>
      )}
    </div>
  )
}
