import { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import { Plus, Check, X, Clock, Dumbbell, Pencil, ChevronUp, ChevronDown, History } from 'lucide-react'

function fmt(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function now() { return Date.now() }

// ─── Main Workout Screen ──────────────────────────────────────────────────────
export default function WorkoutScreen({ startingTemplate, clearTemplate }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { checkForActiveSession() }, [])

  useEffect(() => {
    if (startingTemplate) {
      startFromTemplate(startingTemplate)
      clearTemplate()
    }
  }, [startingTemplate])

  async function checkForActiveSession() {
    const active = await db.workout_sessions
      .filter(s => s.finished_at === null || s.finished_at === undefined)
      .first()
    if (active) {
      const confirmed = window.confirm(
        `You have an unfinished workout from ${new Date(active.started_at).toLocaleDateString()}. Resume it?`
      )
      if (confirmed) {
        setSession(active)
      } else {
        await discardSession(active.id)
      }
    }
    setLoading(false)
  }

  async function discardSession(sessionId) {
    const sexes = await db.session_exercises.where('session_id').equals(sessionId).toArray()
    for (const se of sexes) await db.set_logs.where('session_exercise_id').equals(se.id).delete()
    await db.session_exercises.where('session_id').equals(sessionId).delete()
    await db.workout_sessions.delete(sessionId)
    setSession(null)
  }

  async function startBlank() {
    const id = await db.workout_sessions.add({
      name: `Workout ${new Date().toLocaleDateString()}`,
      template_id: null, started_at: now(), finished_at: null,
      duration_seconds: null, total_volume_lbs: null,
      total_sets_completed: null, notes: ''
    })
    const s = await db.workout_sessions.get(id)
    setSession(s)
  }

  async function startFromTemplate(template) {
    const id = await db.workout_sessions.add({
      name: template.name, template_id: template.id,
      started_at: now(), finished_at: null,
      duration_seconds: null, total_volume_lbs: null,
      total_sets_completed: null, notes: ''
    })
    const texes = await db.template_exercises
      .where('template_id').equals(template.id).toArray()
    texes.sort((a, b) => a.position - b.position)
    for (let i = 0; i < texes.length; i++) {
      const te = texes[i]
      const ex = await db.exercises.get(te.exercise_id)
      const seId = await db.session_exercises.add({
        session_id: id, exercise_id: te.exercise_id,
        exercise_name_snapshot: ex?.name || 'Unknown',
        position: i + 1, superset_group_id: te.superset_group_id || null,
        rep_rest_seconds: te.rep_rest_override_seconds || template.default_rep_rest_seconds,
        exercise_rest_seconds: te.exercise_rest_override_seconds || template.default_exercise_rest_seconds,
        notes: ''
      })
      const sets = await db.template_sets
        .where('template_exercise_id').equals(te.id).sortBy('position')
      for (const s of sets) {
        await db.set_logs.add({
          session_exercise_id: seId, set_number: s.position,
          drop_number: null, set_type: s.set_type,
          target_reps_low: s.target_reps_low, target_reps_high: s.target_reps_high,
          weight_lbs: null, reps_completed: null,
          duration_seconds: null, distance: null, distance_unit: null,
          is_completed: 0, completed_at: null, is_pr: 0, notes: ''
        })
      }
    }
    await db.templates.update(template.id, { last_used_at: now() })
    const s = await db.workout_sessions.get(id)
    setSession(s)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (session) return (
    <LiveWorkout
      session={session}
      onFinish={() => setSession(null)}
      onDiscard={() => discardSession(session.id)}
    />
  )

  return <WorkoutHome onStartBlank={startBlank} onStartFromTemplate={startFromTemplate} />
}

// ─── Workout Home ─────────────────────────────────────────────────────────────
function WorkoutHome({ onStartBlank, onStartFromTemplate }) {
  const [templates, setTemplates]           = useState([])
  const [showPicker, setShowPicker]         = useState(false)
  const [recentSessions, setRecentSessions] = useState([])

  useEffect(() => {
    db.templates.orderBy('created_at').reverse().toArray().then(setTemplates)
    db.workout_sessions
      .filter(s => s.finished_at !== null && s.finished_at !== undefined)
      .toArray()
      .then(all => {
        all.sort((a, b) => b.started_at - a.started_at)
        setRecentSessions(all.slice(0, 3))
      })
  }, [])

  if (showPicker) return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={() => setShowPicker(false)} className="text-blue-400 text-sm mb-3">← Back</button>
        <h1 className="text-xl font-bold">Select Template</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {templates.map(t => (
          <button key={t.id} onClick={() => { setShowPicker(false); onStartFromTemplate(t) }}
            className="w-full px-4 py-3 border-b border-gray-800 text-left hover:bg-gray-800">
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {t.default_rep_rest_seconds}s rep rest · {t.default_exercise_rest_seconds}s exercise rest
            </p>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Ready to train?</h1>
        <p className="text-gray-400 text-sm">Start a workout to begin logging.</p>
      </div>
      <div className="space-y-3">
        <button onClick={onStartBlank}
          className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
          <Plus size={20} /> Start Blank Workout
        </button>
        <button onClick={() => setShowPicker(true)}
          className="w-full bg-gray-700 hover:bg-gray-600 py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
          <Dumbbell size={20} /> Start from Template
        </button>
      </div>
      {recentSessions.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Recent Workouts</p>
          {recentSessions.map(s => (
            <div key={s.id} className="bg-gray-800 rounded-lg p-3 mb-2">
              <p className="font-medium text-sm">{s.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(s.started_at).toLocaleDateString()} ·{' '}
                {s.total_volume_lbs ? `${s.total_volume_lbs.toLocaleString()} lbs` : ''}{' '}
                {s.total_sets_completed ? `· ${s.total_sets_completed} sets` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Live Workout ─────────────────────────────────────────────────────────────
function LiveWorkout({ session, onFinish, onDiscard }) {
  const [exercises, setExercises]       = useState([])
  const [elapsed, setElapsed]           = useState(0)
  const [volume, setVolume]             = useState(0)
  const [totalSets, setTotalSets]       = useState(0)
  const [timer, setTimer]               = useState(null)
  const [timerExpired, setTimerExpired] = useState(false)
  const [showAddEx, setShowAddEx]       = useState(false)
  const [showSummary, setShowSummary]   = useState(false)
  const [summaryData, setSummaryData]   = useState(null)
  const [historyEx, setHistoryEx]       = useState(null)
  const timerRef                        = useRef(null)
  const elapsedRef                      = useRef(null)
  const audioCtxRef                     = useRef(null)
  const timerEndRef                     = useRef(null)  // absolute time when timer should end

  useEffect(() => { loadExercises() }, [])

  // Elapsed ticker
  useEffect(() => {
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((now() - session.started_at) / 1000))
    }, 1000)
    return () => clearInterval(elapsedRef.current)
  }, [])

  // Handle app backgrounding — adjust timer when returning
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && timerEndRef.current) {
        const remaining = Math.max(0, Math.ceil((timerEndRef.current - now()) / 1000))
        setTimer(t => t ? { ...t, seconds: remaining } : null)
        if (remaining === 0) {
          setTimer(null)
          setTimerExpired(true)
          playAlert()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Timer countdown
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!timer || timer.seconds <= 0) {
      if (timer?.seconds === 0) {
        setTimer(null)
        setTimerExpired(true)
        playAlert()
      }
      return
    }
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (!t) return null
        const next = t.seconds - 1
        if (next <= 0) {
          clearInterval(timerRef.current)
          timerEndRef.current = null
          return { ...t, seconds: 0 }
        }
        return { ...t, seconds: next }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timer?.seconds !== undefined ? Math.ceil(timer.seconds / 5) : null])

  function startTimer(seconds, exerciseIdx) {
    timerEndRef.current = now() + seconds * 1000
    setTimerExpired(false)
    setTimer({ seconds, exerciseIdx })
  }

  function initAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    } else if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  }

  function playAlert() {
    try {
      const ctx = audioCtxRef.current
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      osc.start(); osc.stop(ctx.currentTime + 0.8)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    } catch (e) {}
  }

  async function loadExercises() {
    const sexes = await db.session_exercises
      .where('session_id').equals(session.id).toArray()
    sexes.sort((a, b) => a.position - b.position)
    const result = []
    for (const se of sexes) {
      const ex   = await db.exercises.get(se.exercise_id)
      const sets = await db.set_logs
        .where('session_exercise_id').equals(se.id).sortBy('set_number')
      result.push({ se, ex, sets })
    }
    setExercises(result)
    recalcVolume(result)
  }

  function recalcVolume(exList) {
    let vol = 0, sets = 0
    for (const { ex, sets: s } of exList) {
      for (const set of s) {
        if (set.is_completed && ex?.exercise_type === 'strength') {
          vol += (set.weight_lbs || 0) * (set.reps_completed || 0)
        }
        if (set.is_completed) sets++
      }
    }
    setVolume(vol)
    setTotalSets(sets)
  }

  async function updateSet(setId, field, value) {
    await db.set_logs.update(setId, { [field]: value })
    loadExercises()
  }

  async function completeSet(setId, seIdx) {
    initAudio()
    const { se, sets } = exercises[seIdx]

    // Check for PRs before saving
    const setData = sets.find(s => s.id === setId)
    let isPr = 0
    if (setData && se.exercise_id) {
      const allLogs = await db.set_logs
        .where('session_exercise_id')
        .anyOf(
          (await db.session_exercises.where('exercise_id').equals(se.exercise_id).toArray())
            .map(s => s.id)
        )
        .filter(s => s.is_completed === 1 && s.id !== setId)
        .toArray()

      if (setData.weight_lbs && allLogs.length > 0) {
        const maxWeight = Math.max(...allLogs.map(s => s.weight_lbs || 0))
        if (setData.weight_lbs > maxWeight) isPr = 1
      } else if (setData.weight_lbs && allLogs.length === 0) {
        isPr = 1
      }
    }

    await db.set_logs.update(setId, { is_completed: 1, completed_at: now(), is_pr: isPr })
    const remaining = sets.filter(s => s.id !== setId && s.is_completed === 0)
    const isLastSet = remaining.length === 0
    const restSeconds = isLastSet ? se.exercise_rest_seconds : se.rep_rest_seconds
    startTimer(restSeconds, seIdx)
    loadExercises()
  }

  async function uncompleteSet(setId) {
    await db.set_logs.update(setId, { is_completed: 0, completed_at: null, is_pr: 0 })
    loadExercises()
  }

  async function addSet(seIdx) {
    const { se, sets } = exercises[seIdx]
    const lastSet = sets[sets.length - 1]
    await db.set_logs.add({
      session_exercise_id: se.id,
      set_number: sets.length + 1,
      drop_number: null, set_type: 'normal',
      target_reps_low: lastSet?.target_reps_low || null,
      target_reps_high: lastSet?.target_reps_high || null,
      weight_lbs: null, reps_completed: null,
      duration_seconds: null, distance: null, distance_unit: null,
      is_completed: 0, completed_at: null, is_pr: 0, notes: ''
    })
    loadExercises()
  }

  async function removeSet(setId) {
    await db.set_logs.delete(setId)
    loadExercises()
  }

  async function removeExercise(seIdx) {
    const { se, sets } = exercises[seIdx]
    const completedCount = sets.filter(s => s.is_completed).length
    const msg = completedCount > 0
      ? `You have logged ${completedCount} set(s) for this exercise. Removing it will delete those logged sets.`
      : 'Remove this exercise from the workout?'
    if (!window.confirm(msg)) return
    await db.set_logs.where('session_exercise_id').equals(se.id).delete()
    await db.session_exercises.delete(se.id)
    loadExercises()
  }

  async function moveExercise(seIdx, dir) {
    const swapIdx = seIdx + dir
    if (swapIdx < 0 || swapIdx >= exercises.length) return
    const a = exercises[seIdx].se
    const b = exercises[swapIdx].se
    await db.session_exercises.update(a.id, { position: b.position })
    await db.session_exercises.update(b.id, { position: a.position })
    loadExercises()
  }

  async function addExercise(ex) {
    const position = exercises.length + 1
    const seId = await db.session_exercises.add({
      session_id: session.id, exercise_id: ex.id,
      exercise_name_snapshot: ex.name, position,
      superset_group_id: null, rep_rest_seconds: 60,
      exercise_rest_seconds: 90, notes: ''
    })
    await db.set_logs.add({
      session_exercise_id: seId, set_number: 1,
      drop_number: null, set_type: 'normal',
      target_reps_low: null, target_reps_high: null,
      weight_lbs: null, reps_completed: null,
      duration_seconds: null, distance: null, distance_unit: null,
      is_completed: 0, completed_at: null, is_pr: 0, notes: ''
    })
    setShowAddEx(false)
    loadExercises()
  }

  async function finishWorkout() {
    if (totalSets === 0) {
      if (!window.confirm('No sets logged. Discard this workout?')) return
      onDiscard(); return
    }
    const duration = Math.floor((now() - session.started_at) / 1000)
    await db.workout_sessions.update(session.id, {
      finished_at: now(), duration_seconds: duration,
      total_volume_lbs: volume, total_sets_completed: totalSets
    })
    setSummaryData({ duration, volume, totalSets, exercises })
    setShowSummary(true)
  }

  if (showAddEx) return (
    <ExercisePickerForWorkout onSelect={addExercise} onBack={() => setShowAddEx(false)} />
  )

  if (historyEx) return (
    <ExerciseHistorySheet exercise={historyEx} onBack={() => setHistoryEx(null)} />
  )

  if (showSummary) return (
    <WorkoutSummary session={session} data={summaryData} onDone={onFinish} />
  )

  return (
    <div className="flex flex-col h-full">
      {/* Timer expired banner */}
      {timerExpired && (
        <div
          className="fixed inset-x-0 top-0 z-50 bg-blue-600 shadow-lg animate-slide-down"
          style={{ top: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Clock size={22} className="text-white" />
              <div>
                <p className="text-white font-bold text-base">Rest Complete</p>
                <p className="text-blue-200 text-sm">Time to start your next set</p>
              </div>
            </div>
            <button
              onClick={() => setTimerExpired(false)}
              className="bg-white text-blue-600 font-bold px-4 py-2 rounded-lg text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-bold text-lg truncate flex-1 mr-2">{session.name}</h1>
          <button onClick={finishWorkout}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-semibold shrink-0">
            Finish
          </button>
        </div>
        <div className="flex gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={12} /> {fmt(elapsed)}
          </span>
          <span>{volume.toLocaleString()} lbs</span>
          <span>{totalSets} sets</span>
        </div>
      </div>

      {/* Rest timer bar */}
      {timer && timer.seconds > 0 && (
        <div className="bg-blue-900 border-b border-blue-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-blue-300" />
            <span className="text-blue-200 text-xl font-mono font-bold">{fmt(timer.seconds)}</span>
            <span className="text-blue-400 text-sm">rest</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const newSecs = timer.seconds + 15
              timerEndRef.current = now() + newSecs * 1000
              setTimer(t => ({ ...t, seconds: newSecs }))
            }} className="text-blue-300 text-xs px-2 py-1.5 bg-blue-800 rounded">+15s</button>
            <button onClick={() => {
              const newSecs = Math.max(0, timer.seconds - 15)
              timerEndRef.current = now() + newSecs * 1000
              setTimer(t => ({ ...t, seconds: newSecs }))
            }} className="text-blue-300 text-xs px-2 py-1.5 bg-blue-800 rounded">-15s</button>
            <button onClick={() => {
              setTimer(null)
              timerEndRef.current = null
            }} className="text-blue-300 text-xs px-2 py-1.5 bg-blue-800 rounded">Skip</button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {exercises.map(({ se, ex, sets }, seIdx) => (
          <div key={se.id} className="bg-gray-800 rounded-xl p-3">

            {/* Exercise header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">{se.exercise_name_snapshot}</p>
                <RestTimerEdit
                  se={se}
                  onSave={async (repRest, exRest) => {
                    await db.session_exercises.update(se.id, {
                      rep_rest_seconds: repRest,
                      exercise_rest_seconds: exRest
                    })
                    loadExercises()
                  }}
                />
              </div>
              <div className="flex items-center gap-1 ml-2">
                {/* History button */}
                <button onClick={() => setHistoryEx(ex)}
                  className="text-gray-400 hover:text-blue-400 p-1">
                  <History size={15} />
                </button>
                {/* Reorder buttons */}
                <button onClick={() => moveExercise(seIdx, -1)}
                  className="text-gray-400 hover:text-white p-1">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => moveExercise(seIdx, 1)}
                  className="text-gray-400 hover:text-white p-1">
                  <ChevronDown size={15} />
                </button>
                {/* Remove button */}
                <button onClick={() => removeExercise(seIdx)}
                  className="text-gray-500 hover:text-red-400 p-1">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex gap-2 mb-1 px-1">
              <span className="text-xs text-gray-500 w-8">SET</span>
              <span className="text-xs text-gray-500 w-20">TARGET</span>
              {ex?.exercise_type === 'strength' && <span className="text-xs text-gray-500 w-20">LBS</span>}
              {ex?.exercise_type !== 'cardio' && <span className="text-xs text-gray-500 w-16">REPS</span>}
              {ex?.exercise_type === 'cardio' && <span className="text-xs text-gray-500 w-20">TIME</span>}
              {ex?.exercise_type === 'cardio' && <span className="text-xs text-gray-500 w-16">DIST</span>}
              <span className="text-xs text-gray-500 w-8 text-center">✓</span>
            </div>

            {/* Sets */}
            {sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                exerciseType={ex?.exercise_type || 'strength'}
                onComplete={() => completeSet(set.id, seIdx)}
                onUncomplete={() => uncompleteSet(set.id)}
                onUpdate={(field, val) => updateSet(set.id, field, val)}
                onRemove={() => removeSet(set.id)}
              />
            ))}

            <button onClick={() => addSet(seIdx)}
              className="mt-2 text-blue-400 text-xs flex items-center gap-1">
              <Plus size={12} /> Add Set
            </button>
          </div>
        ))}

        <button onClick={() => setShowAddEx(true)}
          className="w-full border border-dashed border-gray-600 text-gray-400 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <Plus size={16} /> Add Exercise
        </button>

        <button onClick={() => {
          if (window.confirm('Discard this workout? All logged sets will be lost.')) onDiscard()
        }} className="w-full text-red-400 text-sm py-2">
          Discard Workout
        </button>
      </div>
    </div>
  )
}

// ─── Rest Timer Edit ──────────────────────────────────────────────────────────
function RestTimerEdit({ se, onSave }) {
  const [editing, setEditing] = useState(false)
  const [repRest, setRepRest] = useState(se.rep_rest_seconds)
  const [exRest, setExRest]   = useState(se.exercise_rest_seconds)

  function save() {
    onSave(Number(repRest), Number(exRest))
    setEditing(false)
  }

  if (!editing) return (
    <div className="flex items-center gap-1 mt-0.5">
      <p className="text-xs text-gray-400">
        Rep: {se.rep_rest_seconds}s · Ex: {se.exercise_rest_seconds}s
      </p>
      <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-blue-400 p-0.5">
        <Pencil size={11} />
      </button>
    </div>
  )

  return (
    <div className="mt-1 bg-gray-700 rounded-lg p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-20">Rep rest (s)</span>
        <input type="number" value={repRest}
          onChange={e => setRepRest(e.target.value)}
          className="w-20 bg-gray-600 rounded px-2 py-1 text-xs outline-none text-center" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-20">Ex rest (s)</span>
        <input type="number" value={exRest}
          onChange={e => setExRest(e.target.value)}
          className="w-20 bg-gray-600 rounded px-2 py-1 text-xs outline-none text-center" />
      </div>
      <div className="flex gap-2">
        <button onClick={save}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs">Save</button>
        <button onClick={() => setEditing(false)}
          className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-xs">Cancel</button>
      </div>
    </div>
  )
}

// ─── Set Row ──────────────────────────────────────────────────────────────────
function SetRow({ set, exerciseType, onComplete, onUncomplete, onUpdate, onRemove }) {
  const done = set.is_completed === 1

  return (
    <div className={`flex gap-2 items-center mb-1.5 rounded-lg p-1 ${done ? 'bg-gray-700 opacity-75' : ''}`}>
      <div className="w-8 flex flex-col items-center">
        <span className="text-xs text-gray-400">{set.set_number}</span>
        {set.is_pr === 1 && <span title="Personal Record">🥇</span>}
      </div>

      <span className="text-xs text-gray-500 w-20">
        {set.target_reps_low
          ? `${set.target_reps_low}${set.target_reps_high !== set.target_reps_low ? `–${set.target_reps_high}` : ''}`
          : '—'}
      </span>

      {exerciseType === 'strength' && (
        <input type="number" inputMode="decimal"
          value={set.weight_lbs ?? ''}
          onChange={e => onUpdate('weight_lbs', e.target.value ? Number(e.target.value) : null)}
          disabled={done} placeholder="0"
          className="w-20 bg-gray-700 rounded px-2 py-1 text-sm text-center outline-none disabled:opacity-50" />
      )}

      {exerciseType !== 'cardio' && (
        <input type="number" inputMode="numeric"
          value={set.reps_completed ?? ''}
          onChange={e => onUpdate('reps_completed', e.target.value ? Number(e.target.value) : null)}
          disabled={done} placeholder="0"
          className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-center outline-none disabled:opacity-50" />
      )}

      {exerciseType === 'cardio' && (
        <input type="number" inputMode="numeric"
          value={set.duration_seconds ?? ''}
          onChange={e => onUpdate('duration_seconds', e.target.value ? Number(e.target.value) : null)}
          disabled={done} placeholder="sec"
          className="w-20 bg-gray-700 rounded px-2 py-1 text-sm text-center outline-none disabled:opacity-50" />
      )}

      {exerciseType === 'cardio' && (
        <input type="number" inputMode="decimal"
          value={set.distance ?? ''}
          onChange={e => onUpdate('distance', e.target.value ? Number(e.target.value) : null)}
          disabled={done} placeholder="mi"
          className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-center outline-none disabled:opacity-50" />
      )}

      <button
        onClick={done ? onUncomplete : onComplete}
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
          ${done ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
        <Check size={14} />
      </button>
    </div>
  )
}

// ─── Exercise History Sheet ───────────────────────────────────────────────────
function ExerciseHistorySheet({ exercise, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const sessionExercises = await db.session_exercises
      .where('exercise_id').equals(exercise.id).toArray()
    const results = []
    for (const se of sessionExercises) {
      const session = await db.workout_sessions.get(se.session_id)
      const sets = await db.set_logs
        .where('session_exercise_id').equals(se.id)
        .filter(s => s.is_completed === 1)
        .toArray()
      if (session?.finished_at && sets.length > 0) results.push({ session, sets })
    }
    results.sort((a, b) => b.session.started_at - a.session.started_at)
    setHistory(results)
    setLoading(false)
  }

  function formatSet(set) {
    if (exercise.exercise_type === 'cardio') {
      const m = Math.floor((set.duration_seconds || 0) / 60)
      const s = (set.duration_seconds || 0) % 60
      return `${m}:${String(s).padStart(2,'0')}${set.distance ? ` · ${set.distance}mi` : ''}`
    }
    if (exercise.exercise_type === 'bodyweight') return `${set.reps_completed} reps`
    return `${set.weight_lbs}lbs × ${set.reps_completed}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back to Workout</button>
        <h1 className="text-xl font-bold">{exercise?.name}</h1>
        <p className="text-xs text-gray-400 mt-1">Full performance history</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && history.length === 0 && (
          <p className="text-gray-500 text-sm">No history yet for this exercise.</p>
        )}
        {history.map(({ session, sets }, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-blue-400 font-medium mb-2">
              {new Date(session.started_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
              })} · {session.name}
            </p>
            {sets.sort((a,b) => a.set_number - b.set_number).map((set, j) => (
              <div key={j} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                <span className="text-xs text-gray-400">Set {set.set_number}</span>
                <span className="text-xs text-gray-200">
                  {formatSet(set)}{set.is_pr ? ' 🥇' : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Exercise Picker for Workout ──────────────────────────────────────────────
function ExercisePickerForWorkout({ onSelect, onBack }) {
  const [exercises, setExercises] = useState([])
  const [search, setSearch]       = useState('')

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setExercises)
  }, [])

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <h1 className="text-xl font-bold mb-3">Add Exercise</h1>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800 text-left">
            <div>
              <p className="text-sm font-medium">{ex.name}</p>
              <p className="text-xs text-gray-400">{ex.exercise_type} · {ex.primary_muscles}</p>
            </div>
            <Plus size={16} className="text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Workout Summary ──────────────────────────────────────────────────────────
function WorkoutSummary({ session, data, onDone }) {
  const { duration, volume, totalSets, exercises } = data

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <h1 className="text-xl font-bold">Workout Complete 🎉</h1>
        <p className="text-sm text-gray-400 mt-1">{session.name}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{fmt(duration)}</p>
            <p className="text-xs text-gray-400 mt-1">Duration</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{volume.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">lbs lifted</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{totalSets}</p>
            <p className="text-xs text-gray-400 mt-1">Sets</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase mb-2">Exercise Breakdown</p>
          {exercises.map(({ se, ex, sets }) => {
            const completedSets = sets.filter(s => s.is_completed)
            if (completedSets.length === 0) return null
            return (
              <div key={se.id} className="bg-gray-800 rounded-lg p-3 mb-2">
                <p className="font-medium text-sm mb-1">{se.exercise_name_snapshot}</p>
                {completedSets.map((s, i) => (
                  <p key={i} className="text-xs text-gray-400">
                    Set {s.set_number}:
                    {ex?.exercise_type === 'strength' ? ` ${s.weight_lbs}lbs × ${s.reps_completed}` : ''}
                    {ex?.exercise_type === 'bodyweight' ? ` ${s.reps_completed} reps` : ''}
                    {ex?.exercise_type === 'cardio' ? ` ${fmt(s.duration_seconds || 0)}${s.distance ? ` · ${s.distance}mi` : ''}` : ''}
                    {s.is_pr ? ' 🥇 PR' : ''}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <button onClick={onDone}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-semibold">
          Done
        </button>
      </div>
    </div>
  )
}