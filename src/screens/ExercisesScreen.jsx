import { useState, useEffect } from 'react'
import { db } from '../db'
import { Search, Plus, ChevronRight } from 'lucide-react'

const MUSCLE_LABELS = {
  chest: 'Chest', lats: 'Lats', lower_back: 'Lower Back', upper_back: 'Upper Back',
  traps: 'Traps', rear_deltoid: 'Rear Delt', anterior_deltoid: 'Front Delt',
  lateral_deltoid: 'Side Delt', biceps: 'Biceps', brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis', triceps: 'Triceps', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core',
  forearms: 'Forearms', hip_flexors: 'Hip Flexors', external_rotators: 'Ext. Rotators',
}

const TYPE_COLORS = {
  strength:   'bg-blue-900 text-blue-300',
  bodyweight: 'bg-green-900 text-green-300',
  cardio:     'bg-orange-900 text-orange-300',
}

const EQUIPMENT_OPTIONS = [
  'barbell','dumbbell','cable','machine','bodyweight','band','kettlebell','none'
]

const MUSCLE_OPTIONS = Object.keys(MUSCLE_LABELS)

export default function ExercisesScreen() {
  const [exercises, setExercises]     = useState([])
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('')
  const [filterMuscle, setFilterMuscle] = useState('')
  const [filterEquip, setFilterEquip] = useState('')
  const [selected, setSelected]       = useState(null)
  const [showCreate, setShowCreate]   = useState(false)

  useEffect(() => { loadExercises() }, [])

  async function loadExercises() {
    const all = await db.exercises.orderBy('name').toArray()
    setExercises(all)
  }

  const filtered = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !filterType   || e.exercise_type === filterType
    const matchMuscle = !filterMuscle || e.primary_muscles.includes(filterMuscle)
    const matchEquip  = !filterEquip  || e.equipment === filterEquip
    return matchSearch && matchType && matchMuscle && matchEquip
  })

  if (selected)  return <ExerciseDetail exercise={selected} onBack={() => { setSelected(null); loadExercises() }} />
  if (showCreate) return <ExerciseForm onBack={() => { setShowCreate(false); loadExercises() }} />

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Exercises</h1>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 rounded-full p-2">
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="w-full bg-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none placeholder-gray-400"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none shrink-0">
            <option value="">All Types</option>
            <option value="strength">Strength</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="cardio">Cardio</option>
          </select>

          <select value={filterMuscle} onChange={e => setFilterMuscle(e.target.value)}
            className="bg-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none shrink-0">
            <option value="">All Muscles</option>
            {MUSCLE_OPTIONS.map(m => (
              <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>
            ))}
          </select>

          <select value={filterEquip} onChange={e => setFilterEquip(e.target.value)}
            className="bg-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none shrink-0">
            <option value="">All Equipment</option>
            {EQUIPMENT_OPTIONS.map(eq => (
              <option key={eq} value={eq}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-gray-500 px-4 py-2">{filtered.length} exercises</p>
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => setSelected(ex)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800 text-left">
            <div>
              <p className="font-medium text-sm">{ex.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[ex.exercise_type]}`}>
                  {ex.exercise_type}
                </span>
                <span className="text-xs text-gray-400">
                  {MUSCLE_LABELS[ex.primary_muscles] || ex.primary_muscles}
                </span>
                {ex.is_custom === 1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">custom</span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Exercise Detail ──────────────────────────────────────────────────────────
function ExerciseDetail({ exercise, onBack }) {
  const [history, setHistory]   = useState([])
  const [editing, setEditing]   = useState(false)
  const [notes, setNotes]       = useState(exercise.notes || '')
  const [saved, setSaved]       = useState(false)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const sessionExercises = await db.session_exercises
      .where('exercise_id').equals(exercise.id).toArray()
    const results = []
    for (const se of sessionExercises) {
      const session = await db.workout_sessions.get(se.session_id)
      const sets    = await db.set_logs.where('session_exercise_id').equals(se.id)
        .filter(s => s.is_completed === 1).toArray()
      if (session && sets.length > 0) results.push({ session, sets })
    }
    results.sort((a, b) => b.session.started_at - a.session.started_at)
    setHistory(results.slice(0, 20))
  }

  async function saveNotes() {
    await db.exercises.update(exercise.id, { notes })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function deleteExercise() {
    if (!window.confirm('Delete this exercise? This cannot be undone.')) return
    await db.exercises.delete(exercise.id)
    onBack()
  }

  const formatSet = (set) => {
    if (exercise.exercise_type === 'cardio') {
      const mins = Math.floor((set.duration_seconds || 0) / 60)
      const secs = (set.duration_seconds || 0) % 60
      return `${mins}:${String(secs).padStart(2,'0')}${set.distance ? ` · ${set.distance}${set.distance_unit}` : ''}`
    }
    if (exercise.exercise_type === 'bodyweight') return `${set.reps_completed} reps`
    return `${set.weight_lbs}lbs × ${set.reps_completed}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{exercise.name}</h1>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[exercise.exercise_type]}`}>
                {exercise.exercise_type}
              </span>
              <span className="text-xs text-gray-400">{MUSCLE_LABELS[exercise.primary_muscles] || exercise.primary_muscles}</span>
              <span className="text-xs text-gray-400">{exercise.equipment}</span>
            </div>
          </div>
          {exercise.is_custom === 1 && (
            <button onClick={deleteExercise} className="text-red-400 text-xs">Delete</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Secondary muscles */}
        {exercise.secondary_muscles && (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Secondary Muscles</p>
            <p className="text-sm text-gray-300">
              {exercise.secondary_muscles.split(',').map(m => MUSCLE_LABELS[m] || m).join(', ')}
            </p>
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Personal Notes / Cues</p>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add your form cues or notes..."
            className="w-full bg-gray-700 rounded-lg p-3 text-sm outline-none placeholder-gray-400 resize-none"
            rows={3}
          />
          <button onClick={saveNotes}
            className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm">
            {saved ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>

        {/* History */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Performance History</p>
          {history.length === 0
            ? <p className="text-sm text-gray-500">No history yet.</p>
            : history.map(({ session, sets }, i) => (
              <div key={i} className="mb-4 bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">
                  {new Date(session.started_at).toLocaleDateString()} · {session.name}
                </p>
                {sets.map((set, j) => (
                  <p key={j} className="text-sm text-gray-200">
                    Set {set.set_number}: {formatSet(set)}
                    {set.is_pr ? ' 🏆' : ''}
                  </p>
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Create Exercise Form ─────────────────────────────────────────────────────
function ExerciseForm({ onBack }) {
  const [form, setForm] = useState({
    name: '', exercise_type: 'strength', primary_muscles: '',
    secondary_muscles: '', equipment: 'barbell', movement_type: 'push', notes: ''
  })
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.primary_muscles)  return setError('Primary muscle is required.')
    const existing = await db.exercises.where('name').equalsIgnoreCase(form.name.trim()).first()
    if (existing) return setError('An exercise with this name already exists.')
    await db.exercises.add({ ...form, name: form.name.trim(), is_custom: 1, created_at: Date.now() })
    onBack()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <h1 className="text-xl font-bold">New Exercise</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Field label="Exercise Name">
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Cable Lateral Raise"
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
        </Field>

        <Field label="Exercise Type">
          <select value={form.exercise_type} onChange={e => set('exercise_type', e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="strength">Strength</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="cardio">Cardio</option>
          </select>
        </Field>

        <Field label="Primary Muscle">
          <select value={form.primary_muscles} onChange={e => set('primary_muscles', e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">Select...</option>
            {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
          </select>
        </Field>

        <Field label="Secondary Muscles (optional)">
          <input value={form.secondary_muscles} onChange={e => set('secondary_muscles', e.target.value)}
            placeholder="e.g. triceps,core"
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
        </Field>

        <Field label="Equipment">
          <select value={form.equipment} onChange={e => set('equipment', e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none">
            {EQUIPMENT_OPTIONS.map(eq => (
              <option key={eq} value={eq}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</option>
            ))}
          </select>
        </Field>

        <Field label="Movement Type">
          <select value={form.movement_type} onChange={e => set('movement_type', e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none">
            {['push','pull','hinge','squat','carry','isolation','cardio'].map(m => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes / Cues (optional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Form cues, reminders..."
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none resize-none"
            rows={3} />
        </Field>

        <button onClick={save}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold">
          Save Exercise
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase mb-1">{label}</p>
      {children}
    </div>
  )
}