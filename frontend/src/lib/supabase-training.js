/* Pull the StrengthStudioTT sessions through this clone's API and show them
   in the openGym store. The request is read-only. Local edits are not pushed. */
export function startSupabaseTraining(useStore) {
  let started = false
  const go = () => {
    if (started || !useStore.getState().ready) return
    started = true
    fetch('/api/training')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data?.workouts?.length) return
        useStore.getState().update(S => {
          S.workouts = data.workouts
          // Supabase stores every weight in pounds. Relabel only; do not convert the numbers.
          S.unit = 'lb'
          S.unitSet = { at: 1, convert: false }
          if (data.bodyweight?.length) S.bodyweight = data.bodyweight
          S.customEx = S.customEx || []
          const incoming = data.customEx || []
          const incomingIds = new Set(incoming.map(ex => ex.id))
          // sx ids are minted from session names. Drop ones this fetch no longer returns
          // so a catalogue match replaces the old custom row. Other local customs stay.
          S.customEx = S.customEx.filter(ex => !String(ex.id).startsWith('sx') || incomingIds.has(ex.id))
          const have = new Set(S.customEx.map(ex => ex.id))
          for (const ex of incoming) {
            if (!have.has(ex.id)) S.customEx.push(ex)
          }
          const weekIds = Object.values(S.week || {}).flat()
          const generated = !weekIds.length || weekIds.every(id => String(id).startsWith('sstt-d'))
          if (data.plan?.routines?.length && generated) {
            const ids = new Set(data.plan.routines.map(routine => routine.id))
            S.routines = [...(S.routines || []).filter(routine => !ids.has(routine.id)), ...data.plan.routines]
            S.week = data.plan.week
          }
          S.exWeights = S.exWeights || {}
          for (const max of data.maxes || []) {
            const current = S.exWeights[max.id]
            if (!current || !(Number(current.w) >= max.w)) S.exWeights[max.id] = { w: max.w, d: '2026-10-14' }
          }
        }, false)
      })
      .catch(() => {})
  }
  if (useStore.getState().ready) go()
  else {
    const unsub = useStore.subscribe(state => {
      if (!state.ready) return
      unsub()
      go()
    })
  }
}
