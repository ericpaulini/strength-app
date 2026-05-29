import { useState, useEffect } from 'react'
import { db } from '../db'
import { Plus, ChevronRight, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react'

const MUSCLE_LABELS = {
  chest: 'Chest', lats: 'Lats', lower_back: 'Lower Back', upper_back: 'Upper Back',
  traps: 'Traps', rear_deltoid: 'Rear Delt', anterior_deltoid: 'Front Delt',
  lateral_deltoid: 'Side Delt', biceps: 'Biceps', brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis', triceps: 'Triceps', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core',
  forearms: 'Forearms', hip_flexors: 'Hip Flexors', external_rotators: 'Ext. Rotators',
}

// ─── Main Templates Screen ────────────────────────────────────────────────────
export default function TemplatesScreen({ onStartWorkout }) {
  const [templates, setTemplates] = useState([])
  const [view, setView]           = useState('list') // list | detail | editor
  const [selected, setSelected]   = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    const all = await db.templates.orderBy('created_at').reverse().toArray()
    setTemplates(all)
  }

  async function duplicateTemplate(t) {
    const texes = await db.template_exercises.where('template_id').equals(t.id).toArray()
    const newId = await db.templates.add({
      ...t, id: undefined, name: t.name + ' (Copy)',
      created_at: Date.now(), updated_at: Date.now(), last_used_at: null
    })
    for (const te of texes) {
      const sets = await db.template_sets.where('template_exercise_id').equals(te.id).toArray()
      const newTeId = await db.template_exercises.add({ ...te, id: undefined, template_id: newId })
      for (const s of sets) await db.template_sets.add({ ...s, id: undefined, template_exercise_id: newTeId })
    }
    loadTemplates()
  }

  async function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return
    const texes = await db.template_exercises.where('template_id').equals(id).toArray()
    for (const te of texes) await db.template_sets.where('template_exercise_id').equals(te.id).delete()
    await db.template_exercises.where('template_id').equals(id).delete()
    await db.templates.delete(id)
    loadTemplates()
  }

  if (view === 'detail') return (
    <TemplateDetail
      template={selected}
      onBack={() => { setView('list'); loadTemplates() }}
      onEdit={() => setView('editor')}
      onStartWorkout={onStartWorkout}
    />
  )

  if (view === 'editor') return (
    <TemplateEditor
      template={editTarget}
      onBack={async () => { await loadTemplates(); setEditTarget(null); setView('list'); }}
    />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700 flex items-center justify-between">
        <h1 className="text-xl font-bold">Templates</h1>
        <button onClick={() => { setEditTarget(null); setView('editor') }}
          className="bg-blue-600 hover:bg-blue-700 rounded-full p-2">
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {templates.length === 0
          ? <p className="text-gray-500 text-sm p-4">No templates yet. Tap + to create one.</p>
          : templates.map(t => (
            <div key={t.id} className="flex items-center border-b border-gray-800">
              <button onClick={() => { setSelected(t); setView('detail') }}
                className="flex-1 flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800">
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Rest: {t.default_rep_rest_seconds}s between sets · {t.default_exercise_rest_seconds}s between exercises
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-500 shrink-0" />
              </button>
              <div className="flex items-center gap-2 pr-3">
                <button onClick={() => duplicateTemplate(t)} className="text-gray-400 hover:text-white p-1">
                  <Copy size={16} />
                </button>
                <button onClick={() => deleteTemplate(t.id)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Template Detail ──────────────────────────────────────────────────────────
function TemplateDetail({ template, onBack, onEdit, onStartWorkout }) {
  const [exercises, setExercises] = useState([])

  useEffect(() => { loadExercises() }, [])

  async function loadExercises() {
    const texes = await db.template_exercises
      .where('template_id').equals(template.id).toArray()
    texes.sort((a, b) => a.position - b.position)
    const result = []
    for (const te of texes) {
      const ex   = await db.exercises.get(te.exercise_id)
      const sets = await db.template_sets.where('template_exercise_id').equals(te.id)
        .sortBy('position')
      result.push({ te, ex, sets })
    }
    setExercises(result)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{template.name}</h1>
            <p className="text-xs text-gray-400 mt-1">
              {template.default_rep_rest_seconds}s rep rest · {template.default_exercise_rest_seconds}s exercise rest
            </p>
          </div>
          <button onClick={onEdit} className="text-blue-400 text-sm">Edit</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {exercises.map(({ te, ex, sets }, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3">
            <p className="font-medium text-sm mb-2">{ex?.name}</p>
            {sets.map((s, j) => (
              <p key={j} className="text-xs text-gray-400">
                Set {s.position}: {s.set_type}
                {s.target_reps_low ? ` · ${s.target_reps_low}${s.target_reps_high !== s.target_reps_low ? `–${s.target_reps_high}` : ''} reps` : ''}
                {s.set_type === 'drop' ? ` · ${s.drop_count} drops` : ''}
                {s.set_type === 'rest_pause' ? ` · ${s.rest_pause_seconds}s pause` : ''}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => onStartWorkout && onStartWorkout(template)}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold">
          Start Workout
        </button>
      </div>
    </div>
  )
}

// ─── Template Editor ──────────────────────────────────────────────────────────
function TemplateEditor({ template, onBack }) {
  const [name, setName]           = useState(template?.name || '')
  const [repRest, setRepRest]     = useState(template?.default_rep_rest_seconds || 60)
  const [exRest, setExRest]       = useState(template?.default_exercise_rest_seconds || 90)
  const [exercises, setExercises] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { if (template) loadExercises() }, [])

  async function loadExercises() {
    const texes = await db.template_exercises
      .where('template_id').equals(template.id).toArray()
    texes.sort((a, b) => a.position - b.position)
    const result = []
    for (const te of texes) {
      const ex   = await db.exercises.get(te.exercise_id)
      const sets = await db.template_sets.where('template_exercise_id').equals(te.id)
        .sortBy('position')
      result.push({ te, ex, sets })
    }
    setExercises(result)
  }

  function addSet(exIdx) {
    const updated = [...exercises]
    updated[exIdx].sets.push({
      id: null, template_exercise_id: null,
      position: updated[exIdx].sets.length + 1,
      set_type: 'normal', target_reps_low: 10, target_reps_high: 10,
      drop_count: null, rest_pause_seconds: null,
      target_duration_seconds: null, target_distance: null, distance_unit: null
    })
    setExercises(updated)
  }

  function removeSet(exIdx, setIdx) {
    const updated = [...exercises]
    updated[exIdx].sets.splice(setIdx, 1)
    updated[exIdx].sets.forEach((s, i) => s.position = i + 1)
    setExercises(updated)
  }

  function updateSet(exIdx, setIdx, field, value) {
    const updated = [...exercises]
    updated[exIdx].sets[setIdx][field] = value
    setExercises(updated)
  }

  function removeExercise(exIdx) {
    const updated = [...exercises]
    updated.splice(exIdx, 1)
    setExercises(updated)
  }

  function moveExercise(exIdx, dir) {
    const updated = [...exercises]
    const swapIdx = exIdx + dir
    if (swapIdx < 0 || swapIdx >= updated.length) return
    ;[updated[exIdx], updated[swapIdx]] = [updated[swapIdx], updated[exIdx]]
    setExercises(updated)
  }

  function addExercise(ex) {
    setExercises(prev => [...prev, {
      te: { template_id: null, exercise_id: ex.id, position: prev.length + 1,
            superset_group_id: null, rep_rest_override_seconds: null,
            exercise_rest_override_seconds: null, notes: '' },
      ex,
      sets: [{ id: null, template_exercise_id: null, position: 1,
               set_type: 'normal', target_reps_low: 10, target_reps_high: 10,
               drop_count: null, rest_pause_seconds: null,
               target_duration_seconds: null, target_distance: null, distance_unit: null }]
    }])
    setShowPicker(false)
  }

  async function save() {
    if (!name.trim()) return setError('Template name is required.')
    if (exercises.length === 0) return setError('Add at least one exercise.')
    for (const { sets } of exercises) {
      if (sets.length === 0) return setError('Each exercise must have at least one set.')
    }

    let templateId = template?.id
    if (templateId) {
      await db.templates.update(templateId, {
        name: name.trim(), default_rep_rest_seconds: Number(repRest),
        default_exercise_rest_seconds: Number(exRest), updated_at: Date.now()
      })
      const oldTexes = await db.template_exercises.where('template_id').equals(templateId).toArray()
      for (const te of oldTexes) await db.template_sets.where('template_exercise_id').equals(te.id).delete()
      await db.template_exercises.where('template_id').equals(templateId).delete()
    } else {
      templateId = await db.templates.add({
        name: name.trim(), default_rep_rest_seconds: Number(repRest),
        default_exercise_rest_seconds: Number(exRest),
        created_at: Date.now(), updated_at: Date.now(), last_used_at: null
      })
    }

    for (let i = 0; i < exercises.length; i++) {
      const { te, sets } = exercises[i]
      const teId = await db.template_exercises.add({
        template_id: templateId, exercise_id: te.exercise_id,
        position: i + 1, superset_group_id: te.superset_group_id || null,
        rep_rest_override_seconds: te.rep_rest_override_seconds || null,
        exercise_rest_override_seconds: te.exercise_rest_override_seconds || null,
        notes: te.notes || ''
      })
      for (let j = 0; j < sets.length; j++) {
        const s = sets[j]
        await db.template_sets.add({
          template_exercise_id: teId, position: j + 1,
          set_type: s.set_type, target_reps_low: Number(s.target_reps_low) || null,
          target_reps_high: Number(s.target_reps_high) || null,
          drop_count: s.set_type === 'drop' ? Number(s.drop_count) || 2 : null,
          rest_pause_seconds: s.set_type === 'rest_pause' ? Number(s.rest_pause_seconds) || 15 : null,
          target_duration_seconds: s.target_duration_seconds || null,
          target_distance: s.target_distance || null, distance_unit: s.distance_unit || null
        })
      }
    }
    onBack()
  }

  if (showPicker) return (
    <ExercisePicker onSelect={addExercise} onBack={() => setShowPicker(false)} />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 px-4 pt-4 pb-3 border-b border-gray-700">
        <button onClick={onBack} className="text-blue-400 text-sm mb-3">← Back</button>
        <h1 className="text-xl font-bold">{template ? 'Edit Template' : 'New Template'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Template name */}
        <div>
          <p className="text-xs text-gray-400 uppercase mb-1">Template Name</p>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Push Day A"
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>

        {/* Rest timers */}
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase mb-1">Rep Rest (s)</p>
            <input type="number" value={repRest} onChange={e => setRepRest(e.target.value)}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase mb-1">Exercise Rest (s)</p>
            <input type="number" value={exRest} onChange={e => setExRest(e.target.value)}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
        </div>

        {/* Exercise list */}
        <div>
          <p className="text-xs text-gray-400 uppercase mb-2">Exercises</p>
          <div className="space-y-3">
            {exercises.map(({ ex, te, sets }, exIdx) => (
              <div key={exIdx} className="bg-gray-800 rounded-lg p-3">
                {/* Exercise header */}
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm flex-1">{ex?.name}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveExercise(exIdx, -1)} className="text-gray-400 p-1">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => moveExercise(exIdx, 1)} className="text-gray-400 p-1">
                      <ChevronDown size={14} />
                    </button>
                    <button onClick={() => removeExercise(exIdx)} className="text-red-400 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sets */}
                {sets.map((s, setIdx) => (
                  <div key={setIdx} className="bg-gray-700 rounded p-2 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 w-10">Set {s.position}</span>
                      <select value={s.set_type}
                        onChange={e => updateSet(exIdx, setIdx, 'set_type', e.target.value)}
                        className="bg-gray-600 rounded px-2 py-1 text-xs outline-none flex-1">
                        <option value="normal">Normal</option>
                        <option value="drop">Drop Set</option>
                        <option value="rest_pause">Rest-Pause</option>
                      </select>
                      <button onClick={() => removeSet(exIdx, setIdx)} className="text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Rep targets */}
                    {ex?.exercise_type !== 'cardio' && (
                      <div className="flex gap-2 items-center">
                        <input type="number" value={s.target_reps_low}
                          onChange={e => updateSet(exIdx, setIdx, 'target_reps_low', e.target.value)}
                          className="bg-gray-600 rounded px-2 py-1 text-xs outline-none w-16"
                          placeholder="Low" />
                        <span className="text-xs text-gray-400">–</span>
                        <input type="number" value={s.target_reps_high}
                          onChange={e => updateSet(exIdx, setIdx, 'target_reps_high', e.target.value)}
                          className="bg-gray-600 rounded px-2 py-1 text-xs outline-none w-16"
                          placeholder="High" />
                        <span className="text-xs text-gray-400">reps</span>
                      </div>
                    )}

                    {/* Drop set extras */}
                    {s.set_type === 'drop' && (
                      <div className="flex gap-2 items-center mt-2">
                        <span className="text-xs text-gray-400">Drops:</span>
                        <input type="number" value={s.drop_count || 2}
                          onChange={e => updateSet(exIdx, setIdx, 'drop_count', e.target.value)}
                          className="bg-gray-600 rounded px-2 py-1 text-xs outline-none w-16" />
                      </div>
                    )}

                    {/* Rest-pause extras */}
                    {s.set_type === 'rest_pause' && (
                      <div className="flex gap-2 items-center mt-2">
                        <span className="text-xs text-gray-400">Pause (s):</span>
                        <input type="number" value={s.rest_pause_seconds || 15}
                          onChange={e => updateSet(exIdx, setIdx, 'rest_pause_seconds', e.target.value)}
                          className="bg-gray-600 rounded px-2 py-1 text-xs outline-none w-16" />
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={() => addSet(exIdx)}
                  className="text-blue-400 text-xs mt-1">+ Add Set</button>
              </div>
            ))}
          </div>

          <button onClick={() => setShowPicker(true)}
            className="w-full mt-3 border border-dashed border-gray-600 text-gray-400 py-3 rounded-lg text-sm">
            + Add Exercise
          </button>
        </div>

        <button onClick={save}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold">
          Save Template
        </button>
      </div>
    </div>
  )
}

// ─── Exercise Picker ──────────────────────────────────────────────────────────
function ExercisePicker({ onSelect, onBack }) {
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
        <h1 className="text-xl font-bold mb-3">Select Exercise</h1>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800 text-left">
            <div>
              <p className="text-sm font-medium">{ex.name}</p>
              <p className="text-xs text-gray-400">{MUSCLE_LABELS[ex.primary_muscles] || ex.primary_muscles}</p>
            </div>
            <Plus size={16} className="text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  )
}