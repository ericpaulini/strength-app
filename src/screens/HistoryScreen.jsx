import { useState, useEffect } from 'react'
import { db } from '../db'
import { ChevronRight, Trash2 } from 'lucide-react'

function fmt(seconds) {
  const m = Math.floor((seconds || 0) / 60)
  const s = (seconds || 0) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Main History Screen ──────────────────────────────────────────────────────
export default function HistoryScreen() {
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    const all = await db.workout_sessions
      .filter(s => s.finished_at !== null && s.finished_at !== undefined)
      .toArray()
    all.sort((a, b) => b.started_at - a.started_at)
    setSessions(all)
  }

  async function deleteSession(id) {
    if (!window.confirm('Permanently delete this workout and all logged sets? This cannot be undone.')) return
    const sexes = await db.session_exercises.where('session_id').equals(id).toArray()
    for (const se of sexes) await db.set_logs.where('session_exercise_id').equals(se.id).delete()
    await db.session_exercises.where('session_id').equals(id).delete()
    await db.workout_sessions.delete(id)
    setSelected(null)
    loadSessions()
  }

  if (selected) return (
    <SessionDetail
      session={selected}
      onBack={() => { setSelected(null); loadSessions() }}
      onDelete={() => deleteSession(selected.id)}
    />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <h1 className="text-xl font-bold">History</h1>
        <p className="text-xs text-gray-400 mt-1">{sessions.length} workout{sessions.length !== 1 ? 's' : ''} logged</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0
          ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-gray-400 text-sm">No workouts logged yet.</p>
              <p className="text-gray-500 text-xs mt-1">Completed workouts will appear here.</p>
            </div>
          )
          : sessions.map(s => (
            <button key={s.id} onClick={() => setSelected(s)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800 text-left">
              <div className="flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-gray-400">
                    {new Date(s.started_at).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })}
                  </span>
                  <span className="text-xs text-gray-500">{fmt(s.duration_seconds)}</span>
                  {s.total_volume_lbs > 0 && (
                    <span className="text-xs text-gray-500">{s.total_volume_lbs.toLocaleString()} lbs</span>
                  )}
                  {s.total_sets_completed > 0 && (
                    <span className="text-xs text-gray-500">{s.total_sets_completed} sets</span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-500 shrink-0" />
            </button>
          ))
        }
      </div>
    </div>
  )
}

// ─── Session Detail ───────────────────────────────────────────────────────────
function SessionDetail({ session, onBack, onDelete }) {
  const [exercises, setExercises] = useState([])
  const [notes, setNotes]         = useState(session.notes || '')
  const [saved, setSaved]         = useState(false)

  useEffect(() => { loadExercises() }, [])

  async function loadExercises() {
    const sexes = await db.session_exercises
      .where('session_id').equals(session.id).toArray()
    sexes.sort((a, b) => a.position - b.position)
    const result = []
    for (const se of sexes) {
      const ex   = await db.exercises.get(se.exercise_id)
      const sets = await db.set_logs
        .where('session_exercise_id').equals(se.id)
        .filter(s => s.is_completed === 1)
        .sortBy('set_number')
      if (sets.length > 0) result.push({ se, ex, sets })
    }
    setExercises(result)
  }

  async function saveNotes() {
    await db.workout_sessions.update(session.id, { notes })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function formatSet(set, exerciseType) {
    if (exerciseType === 'cardio') {
      return `${fmt(set.duration_seconds)}${set.distance ? ` · ${set.distance}mi` : ''}`
    }
    if (exerciseType === 'bodyweight') return `${set.reps_completed} reps`
    return `${set.weight_lbs ?? '?'}lbs × ${set.reps_completed ?? '?'}`
  }

  const date = new Date(session.started_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-xs text-gray-400 mt-1">{date}</p>
          </div>
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 p-1">
            <Trash2 size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mt-3">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-400">{fmt(session.duration_seconds)}</p>
            <p className="text-xs text-gray-500">Duration</p>
          </div>
          {session.total_volume_lbs > 0 && (
            <div className="text-center">
              <p className="text-sm font-bold text-blue-400">{session.total_volume_lbs.toLocaleString()}</p>
              <p className="text-xs text-gray-500">lbs lifted</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-bold text-blue-400">{session.total_sets_completed}</p>
            <p className="text-xs text-gray-500">Sets</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Exercise breakdown */}
        {exercises.map(({ se, ex, sets }) => (
          <div key={se.id} className="bg-gray-800 rounded-lg p-3">
            <p className="font-medium text-sm mb-2">{se.exercise_name_snapshot}</p>
            {sets.map((set, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0">
                <span className="text-xs text-gray-400">Set {set.set_number}</span>
                <span className="text-xs text-gray-200">
                  {formatSet(set, ex?.exercise_type || 'strength')}
                  {set.is_pr ? ' 🏆' : ''}
                </span>
              </div>
            ))}
          </div>
        ))}

        {/* Notes */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Workout Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did the workout feel? Any notes..."
            className="w-full bg-gray-700 rounded-lg p-3 text-sm outline-none placeholder-gray-500 resize-none"
            rows={3}
          />
          <button onClick={saveNotes}
            className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm">
            {saved ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}