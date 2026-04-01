'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsRoutine } from '../types'

const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

export default function RoutinesTab() {
  const [routines, setRoutines] = useState<TsRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchRoutines = useCallback(async () => {
    const sb = createClient()
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const from = new Date(year, month, 1).toISOString().slice(0, 10)
    const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)

    const { data } = await sb
      .from('ts_routines')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
    setRoutines((data || []) as TsRoutine[])
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { fetchRoutines() }, [fetchRoutines])

  const selectedRoutine = routines.find(r => r.date === selectedDate)

  const handleSave = async (data: Partial<TsRoutine>) => {
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSaving(false); return }

    if (selectedRoutine) {
      await sb.from('ts_routines').update({ ...data, updated_at: new Date().toISOString() }).eq('id', selectedRoutine.id)
    } else {
      await sb.from('ts_routines').insert({ ...data, user_id: user.id, date: selectedDate })
    }
    await fetchRoutines()
    setEditing(false)
    setSaving(false)
  }

  // Calendar grid
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // Monday = 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Routines & Psychologie</h2>
          <p className="text-xs text-text-dim mt-0.5">Track dagelijks je mentale staat, discipline en gewoonten.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1.5 rounded hover:bg-white/5 text-text-dim hover:text-heading transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <h3 className="text-sm font-semibold text-heading capitalize">
              {MONTHS_NL[month]} {year}
            </h3>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1.5 rounded hover:bg-white/5 text-text-dim hover:text-heading transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
              <div key={d} className="text-center text-[10px] text-text-dim py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const routine = routines.find(r => r.date === dateStr)
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === new Date().toISOString().slice(0, 10)

              // Score color
              let bgColor = ''
              if (routine) {
                const score = routine.discipline_score || 0
                if (score >= 8) bgColor = 'bg-green-500/20'
                else if (score >= 5) bgColor = 'bg-amber-500/15'
                else if (score > 0) bgColor = 'bg-red-500/15'
                else bgColor = 'bg-white/5'
              }

              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDate(dateStr); setEditing(false) }}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                    isSelected ? 'ring-1 ring-accent-light' : ''
                  } ${bgColor || 'hover:bg-white/5'} ${
                    isToday ? 'font-bold text-heading' : routine ? 'text-heading' : 'text-text-dim'
                  }`}
                >
                  {day}
                  {routine && routine.mood_before && (
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(routine.mood_before, 5) }).map((_, j) => (
                        <div key={j} className="w-1 h-1 rounded-full bg-accent-light/60" />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day detail / form */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-heading">
              {new Date(selectedDate + 'T00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-accent-light hover:text-heading transition-colors">
                {selectedRoutine ? 'Bewerken' : 'Invullen'}
              </button>
            )}
          </div>

          {editing ? (
            <RoutineForm
              routine={selectedRoutine || null}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : selectedRoutine ? (
            <RoutineDetail routine={selectedRoutine} />
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-text-dim mb-2">Geen routine ingevuld</p>
              <button onClick={() => setEditing(true)} className="text-sm text-accent-light hover:text-heading transition-colors">
                Nu invullen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Routine detail view ───────────────────────────────────
function RoutineDetail({ routine }: { routine: TsRoutine }) {
  return (
    <div className="space-y-4 text-xs">
      {/* Scores */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreDisplay label="Discipline" value={routine.discipline_score} max={10} />
        <ScoreDisplay label="Executie" value={routine.execution_score} max={10} />
        <ScoreDisplay label="Geduld" value={routine.patience_score} max={10} />
      </div>

      {/* Mood */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-text-dim mb-1">Mood ochtend</p>
          <MoodIndicator value={routine.mood_before} />
        </div>
        <div>
          <p className="text-[10px] text-text-dim mb-1">Mood avond</p>
          <MoodIndicator value={routine.mood_after} />
        </div>
      </div>

      {/* Pre-session checklist */}
      <div>
        <p className="text-[10px] text-text-dim mb-1.5 uppercase tracking-wider font-semibold">Pre-sessie</p>
        <div className="space-y-1">
          <CheckItem label="Goed geslapen" checked={routine.sleep_quality !== null && routine.sleep_quality >= 3} />
          <CheckItem label="Gesport" checked={routine.exercised} />
          <CheckItem label="Gemediteerd" checked={routine.meditated} />
          <CheckItem label="Nieuws gecheckt" checked={routine.news_checked} />
          <CheckItem label="Plan geschreven" checked={routine.plan_written} />
        </div>
      </div>

      {/* Post-session */}
      <div>
        <p className="text-[10px] text-text-dim mb-1.5 uppercase tracking-wider font-semibold">Post-sessie</p>
        <div className="space-y-1">
          <CheckItem label="Plan gevolgd" checked={routine.followed_plan === true} negative={routine.followed_plan === false} />
          <CheckItem label="Overtraded" checked={routine.overtraded} isNegative />
          <CheckItem label="Revenge traded" checked={routine.revenge_traded} isNegative />
          <CheckItem label="Forced setups" checked={routine.forced_setups} isNegative />
          <CheckItem label="Risk regels gebroken" checked={routine.broke_risk_rules} isNegative />
        </div>
      </div>

      {/* Emotions */}
      <div className="flex flex-wrap gap-1">
        {routine.felt_fear && <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400">Angst</span>}
        {routine.felt_greed && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Hebzucht</span>}
        {routine.felt_frustration && <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400">Frustratie</span>}
      </div>

      {routine.notes && (
        <div>
          <p className="text-[10px] text-text-dim mb-1">Notities</p>
          <p className="text-text-muted leading-relaxed">{routine.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Routine form ──────────────────────────────────────────
function RoutineForm({ routine, saving, onSave, onCancel }: {
  routine: TsRoutine | null
  saving: boolean
  onSave: (data: Partial<TsRoutine>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => routine ? { ...routine } : {
    sleep_quality: null, exercised: false, meditated: false, news_checked: false, plan_written: false, prepared_properly: false,
    mood_before: null, mood_after: null, focus_level: null, stress_level: null,
    followed_plan: null, overtraded: false, revenge_traded: false, forced_setups: false, broke_risk_rules: false,
    felt_fear: false, felt_greed: false, felt_frustration: false,
    discipline_score: null, execution_score: null, patience_score: null,
    notes: '',
  })

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="space-y-4 text-xs">
      {/* Scores */}
      <div>
        <p className="text-[10px] text-text-dim mb-2 uppercase tracking-wider font-semibold">Scores (1-10)</p>
        <div className="space-y-2">
          <SliderField label="Discipline" value={form.discipline_score as number | null} onChange={(v) => set('discipline_score', v)} />
          <SliderField label="Executie" value={form.execution_score as number | null} onChange={(v) => set('execution_score', v)} />
          <SliderField label="Geduld" value={form.patience_score as number | null} onChange={(v) => set('patience_score', v)} />
        </div>
      </div>

      {/* Mood */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-text-dim mb-1">Mood ochtend</p>
          <MoodSelector value={form.mood_before as number | null} onChange={(v) => set('mood_before', v)} />
        </div>
        <div>
          <p className="text-[10px] text-text-dim mb-1">Mood avond</p>
          <MoodSelector value={form.mood_after as number | null} onChange={(v) => set('mood_after', v)} />
        </div>
      </div>

      {/* Pre-session toggles */}
      <div>
        <p className="text-[10px] text-text-dim mb-2 uppercase tracking-wider font-semibold">Pre-sessie</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'exercised', label: 'Gesport' },
            { key: 'meditated', label: 'Gemediteerd' },
            { key: 'news_checked', label: 'Nieuws' },
            { key: 'plan_written', label: 'Plan' },
            { key: 'prepared_properly', label: 'Voorbereid' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => set(item.key, !(form[item.key] as boolean))}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                form[item.key] ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'text-text-dim border-border hover:text-heading'
              }`}
            >
              {form[item.key] ? '✓ ' : ''}{item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post-session toggles */}
      <div>
        <p className="text-[10px] text-text-dim mb-2 uppercase tracking-wider font-semibold">Post-sessie</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => set('followed_plan', form.followed_plan === true ? false : true)}
            className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${form.followed_plan === true ? 'bg-green-500/10 text-green-400 border-green-500/20' : form.followed_plan === false ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'text-text-dim border-border'}`}>
            Plan gevolgd
          </button>
          {[
            { key: 'overtraded', label: 'Overtraded' },
            { key: 'revenge_traded', label: 'Revenge' },
            { key: 'forced_setups', label: 'Forced' },
            { key: 'broke_risk_rules', label: 'Risk broken' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => set(item.key, !(form[item.key] as boolean))}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                form[item.key] ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'text-text-dim border-border hover:text-heading'
              }`}
            >
              {form[item.key] ? '! ' : ''}{item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emotions */}
      <div>
        <p className="text-[10px] text-text-dim mb-2 uppercase tracking-wider font-semibold">Emoties</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'felt_fear', label: 'Angst' },
            { key: 'felt_greed', label: 'Hebzucht' },
            { key: 'felt_frustration', label: 'Frustratie' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => set(item.key, !(form[item.key] as boolean))}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                form[item.key] ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'text-text-dim border-border hover:text-heading'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[10px] text-text-dim mb-1">Notities</p>
        <textarea
          value={(form.notes as string) || ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="form-input w-full resize-none"
          placeholder="Dagelijkse reflectie..."
        />
      </div>

      {/* Save */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSave(form as Partial<TsRoutine>)}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-sm text-text-muted hover:text-heading transition-colors">Annuleren</button>
      </div>
    </div>
  )
}

// ─── Helper components ─────────────────────────────────────
function ScoreDisplay({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value ? (value / max) * 100 : 0
  const color = value ? (value >= max * 0.7 ? 'bg-green-500' : value >= max * 0.4 ? 'bg-amber-500' : 'bg-red-500') : 'bg-white/10'
  return (
    <div>
      <p className="text-[10px] text-text-dim mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/5">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-heading">{value || '—'}</span>
      </div>
    </div>
  )
}

function MoodIndicator({ value }: { value: number | null }) {
  const moods = ['', '😫', '😕', '😐', '🙂', '😊']
  return <span className="text-sm">{value ? moods[value] : '—'}</span>
}

function MoodSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const moods = [{ v: 1, e: '😫' }, { v: 2, e: '😕' }, { v: 3, e: '😐' }, { v: 4, e: '🙂' }, { v: 5, e: '😊' }]
  return (
    <div className="flex gap-1">
      {moods.map(m => (
        <button
          key={m.v}
          type="button"
          onClick={() => onChange(m.v)}
          className={`w-8 h-8 rounded-lg text-sm transition-all ${value === m.v ? 'bg-accent/20 ring-1 ring-accent/30 scale-110' : 'hover:bg-white/5'}`}
        >
          {m.e}
        </button>
      ))}
    </div>
  )
}

function SliderField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-text-dim w-16">{label}</span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`flex-1 h-5 rounded text-[9px] transition-colors ${
              value && i < value
                ? i < 3 ? 'bg-red-500/40' : i < 6 ? 'bg-amber-500/40' : 'bg-green-500/40'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-heading w-6 text-right">{value || '—'}</span>
    </div>
  )
}

function CheckItem({ label, checked, negative, isNegative }: { label: string; checked: boolean; negative?: boolean; isNegative?: boolean }) {
  if (isNegative) {
    return (
      <div className="flex items-center gap-2">
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
        )}
        <span className={`${checked ? 'text-red-400' : 'text-text-muted'}`}>{label}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
      ) : negative ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      ) : (
        <div className="w-3 h-3 rounded-sm border border-white/10" />
      )}
      <span className={`${checked ? 'text-heading' : negative ? 'text-red-400' : 'text-text-dim'}`}>{label}</span>
    </div>
  )
}
