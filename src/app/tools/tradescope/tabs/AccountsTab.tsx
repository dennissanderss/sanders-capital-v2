'use client'

import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import { useStrategies } from '../hooks/useStrategies'
import { useSetups } from '../hooks/useSetups'
import type { TsAccount, TsStrategy } from '../types'

const ACCOUNT_TYPES = [
  { value: 'demo', label: 'Demo', color: 'text-blue-400 bg-blue-500/10' },
  { value: 'sim', label: 'Simulatie', color: 'text-purple-400 bg-purple-500/10' },
  { value: 'live', label: 'Live', color: 'text-green-400 bg-green-500/10' },
  { value: 'funded', label: 'Funded', color: 'text-amber-400 bg-amber-500/10' },
  { value: 'prop_firm', label: 'Prop Firm', color: 'text-gold bg-gold-dim' },
]

export default function AccountsTab() {
  return (
    <div className="space-y-8">
      <AccountsSection />
      <StrategiesSection />
      <SetupsSection />
    </div>
  )
}

// ─── Accounts ──────────────────────────────────────────────
function AccountsSection() {
  const { accounts, loading, create, update, remove } = useAccounts()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'live' as TsAccount['type'], broker: '', starting_balance: '10000', currency: 'USD', notes: '' })

  const resetForm = () => {
    setForm({ name: '', type: 'live', broker: '', starting_balance: '10000', currency: 'USD', notes: '' })
    setEditId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const data = {
      name: form.name,
      type: form.type,
      broker: form.broker || null,
      starting_balance: parseFloat(form.starting_balance) || 10000,
      currency: form.currency,
      notes: form.notes || null,
    }
    if (editId) {
      await update(editId, data)
    } else {
      await create(data)
    }
    resetForm()
  }

  const startEdit = (acc: TsAccount) => {
    setForm({
      name: acc.name,
      type: acc.type,
      broker: acc.broker || '',
      starting_balance: acc.starting_balance.toString(),
      currency: acc.currency,
      notes: acc.notes || '',
    })
    setEditId(acc.id)
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Accounts</h2>
          <p className="text-xs text-text-dim mt-0.5">Beheer je trading accounts (demo, live, funded, etc.)</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Account toevoegen
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" /></div>
      ) : accounts.length === 0 && !showForm ? (
        <div className="py-12 text-center glass rounded-xl">
          <p className="text-text-muted mb-1">Nog geen accounts</p>
          <p className="text-sm text-text-dim">Maak een account aan om trades te kunnen loggen.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map(acc => {
            const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type)
            return (
              <div key={acc.id} className="p-4 rounded-xl glass group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-heading">{acc.name}</h3>
                    {acc.broker && <p className="text-xs text-text-dim mt-0.5">{acc.broker}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${typeInfo?.color || 'text-text-dim bg-white/5'}`}>
                    {typeInfo?.label || acc.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-text-dim">Startbalans</p>
                    <p className="text-sm font-semibold text-heading">${acc.starting_balance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim">Valuta</p>
                    <p className="text-sm text-heading">{acc.currency}</p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(acc)} className="text-xs text-accent-light hover:text-heading transition-colors">Bewerken</button>
                  <button onClick={() => { if (confirm('Account verwijderen?')) remove(acc.id) }} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Verwijderen</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Account form */}
      {showForm && (
        <div className="mt-4 p-4 rounded-xl glass border border-accent/20">
          <h3 className="text-sm font-semibold text-heading mb-3">{editId ? 'Account bewerken' : 'Nieuw account'}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Naam *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="form-input w-full" placeholder="bijv. FTMO Challenge" />
            </div>
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value as TsAccount['type'] }))} className="form-input w-full">
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Broker</label>
              <input value={form.broker} onChange={(e) => setForm(f => ({ ...f, broker: e.target.value }))} className="form-input w-full" placeholder="bijv. OANDA, FTMO" />
            </div>
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Startbalans</label>
              <input type="number" value={form.starting_balance} onChange={(e) => setForm(f => ({ ...f, starting_balance: e.target.value }))} className="form-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Valuta</label>
              <select value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} className="form-input w-full">
                {['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] text-text-dim mb-1">Notities</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="form-input w-full resize-none" placeholder="Optionele notities..." />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors">
              {editId ? 'Bijwerken' : 'Toevoegen'}
            </button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded-lg text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Strategies ────────────────────────────────────────────
function StrategiesSection() {
  const { strategies, loading, create, remove } = useStrategies()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', rules: '', color: '#3d6ea5' })

  const handleSave = async () => {
    if (!form.name.trim()) return
    await create({ name: form.name, description: form.description || null, rules: form.rules || null, color: form.color })
    setForm({ name: '', description: '', rules: '', color: '#3d6ea5' })
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Strategieen</h2>
          <p className="text-xs text-text-dim mt-0.5">Definieer je trading strategieen voor analyse.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Strategie
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {strategies.map(s => (
          <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg glass group">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-sm text-heading">{s.name}</span>
            {s.description && <span className="text-xs text-text-dim">— {s.description}</span>}
            <button onClick={() => { if (confirm('Strategie verwijderen?')) remove(s.id) }} className="text-xs text-red-400/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
        {strategies.length === 0 && !loading && <p className="text-sm text-text-dim">Nog geen strategieen gedefinieerd.</p>}
      </div>

      {showForm && (
        <div className="mt-3 p-4 rounded-xl glass border border-accent/20">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Naam *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="form-input w-full" placeholder="bijv. ICT Silver Bullet" />
            </div>
            <div>
              <label className="block text-[10px] text-text-dim mb-1">Kleur</label>
              <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} className="w-full h-9 rounded cursor-pointer" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] text-text-dim mb-1">Beschrijving</label>
            <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="form-input w-full" placeholder="Korte beschrijving..." />
          </div>
          <div className="mt-3">
            <label className="block text-[10px] text-text-dim mb-1">Regels</label>
            <textarea value={form.rules} onChange={(e) => setForm(f => ({ ...f, rules: e.target.value }))} rows={3} className="form-input w-full resize-none" placeholder="Strategie regels en criteria..." />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors">Toevoegen</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-lg text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Setups ────────────────────────────────────────────────
function SetupsSection() {
  const { setups, loading, create, remove } = useSetups()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const handleSave = async () => {
    if (!form.name.trim()) return
    await create({ name: form.name, description: form.description || null })
    setForm({ name: '', description: '' })
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Setups</h2>
          <p className="text-xs text-text-dim mt-0.5">Setup types voor gedetailleerde analyse (bijv. FVG Entry, Breaker Block).</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Setup
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {setups.map(s => (
          <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg glass group">
            <span className="text-sm text-heading">{s.name}</span>
            <button onClick={() => { if (confirm('Setup verwijderen?')) remove(s.id) }} className="text-xs text-red-400/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
        {setups.length === 0 && !loading && <p className="text-sm text-text-dim">Nog geen setups gedefinieerd.</p>}
      </div>

      {showForm && (
        <div className="mt-3 p-4 rounded-xl glass border border-accent/20 inline-flex gap-2 items-end">
          <div>
            <label className="block text-[10px] text-text-dim mb-1">Naam *</label>
            <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="bijv. FVG Entry" />
          </div>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors">Toevoegen</button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
        </div>
      )}
    </div>
  )
}
