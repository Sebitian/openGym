import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtVol, isoOf, todayISO, MONTHS, weekStartOf, weekDayOffset } from '../lib/format.js'
import { workoutDay, workoutDuration, workoutVolume } from '../lib/history.js'
import { t, tn } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { Segmented } from './ui.jsx'
import { dayNoteOf, dayNoteLine } from '../lib/day-notes.js'

const normalizeMetric = value => value === 'vol' ? 'vol' : 'time'

// Legacy records without entries only have the cached volume available. Current records are
// always recomputed from their completed sets so unit changes and warm-up/per-side rules stay
// authoritative.
const volumeOf = w => {
  if (Array.isArray(w?.entries)) return Math.max(0, Number(workoutVolume(w)) || 0)
  const volume = Number(w?.vol)
  return Number.isFinite(volume) ? Math.max(0, volume) : 0
}

// GitHub-style activity heatmap, shaded by the selected time or volume metric per day.
export default function Heatmap({ S, onDay, metric: selectedMetric, onMetricChange }) {
  const wrapRef = useRef(null)
  const [localMetric, setLocalMetric] = useState(() => normalizeMetric(selectedMetric ?? S?.heatmapMetric))

  const metric = normalizeMetric(selectedMetric ?? localMetric)
  const metricValue = metric === 'vol' ? 'vol' : 'min'
  const changeMetric = value => {
    const next = normalizeMetric(value)
    if (selectedMetric == null) setLocalMetric(next)
    onMetricChange?.(next)
  }

  const agg = {}
  ;(S.workouts || []).forEach(w => {
    const day = workoutDay(w)
    if (!day) return
    const a = agg[day] = agg[day] || { n: 0, vol: 0, min: 0 }
    a.n++
    a.vol += volumeOf(w)
    a.min += Math.max(0, Math.round(workoutDuration(w) / 60000))
  })
  const values = Object.values(agg).map(a => a[metricValue]).filter(v => v > 0).sort((a, b) => a - b)
  const q = p => (values.length ? values[Math.min(values.length - 1, Math.floor(p * values.length))] : 0)
  const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75)
  const level = a => !a ? 0 : !a[metricValue] ? 1 : a[metricValue] >= t3 ? 4 : a[metricValue] >= t2 ? 3 : a[metricValue] >= t1 ? 2 : 1

  const today = new Date(); today.setHours(12, 0, 0, 0)
  const ws = weekStartOf(S)
  const end = new Date(today); end.setDate(today.getDate() - weekDayOffset(today.getDay(), ws))
  // At least a year, and further back when history is older, so an earlier cycle stays reachable.
  const earliestDay = Object.keys(agg).sort()[0]
  let weeksBack = 52
  if (earliestDay) {
    const earliest = new Date(earliestDay + 'T12:00:00')
    earliest.setDate(earliest.getDate() - weekDayOffset(earliest.getDay(), ws))
    if (earliest < end) weeksBack = Math.max(52, Math.round((end - earliest) / (7 * 86400000)))
  }
  const start = new Date(end); start.setDate(end.getDate() - weeksBack * 7)

  const dayLabels = Array(7).fill(null)
  dayLabels[weekDayOffset(1, ws)] = 'Mon'
  dayLabels[weekDayOffset(3, ws)] = 'Wed'
  dayLabels[weekDayOffset(5, ws)] = 'Fri'

  const months = [], cols = []
  let lastMonth = -1
  for (let wk = 0; wk <= weeksBack; wk++) {
    const colStart = new Date(start); colStart.setDate(start.getDate() + wk * 7)
    const mo = colStart.getMonth()
    const showM = mo !== lastMonth && colStart.getDate() <= 7 && wk < weeksBack
    months.push(<span key={wk}>{showM ? t(MONTHS[mo]) : ''}</span>)
    if (colStart.getDate() <= 7) lastMonth = mo
    const cells = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart); day.setDate(colStart.getDate() + d)
      const key = isoOf(day)
      const a = agg[key]
      // A day off with a note (#261): outlined, its note in the tooltip, and tappable like a
      // trained day so the note can be read (and changed) on a phone too.
      const note = !a && dayNoteOf(S, key)
      const cls = 'hm-c l' + level(a) + (note ? ' noted' : '') + (key === todayISO() ? ' today' : '') + (day > today ? ' future' : '')
      cells.push(<div key={d} className={cls}
        title={key + (a ? ` · ${tn('{0} workout', '{0} workouts', a.n)} · ${t('{0} min', a.min)} · ${fmtVol(a.vol, S.unit)}` : note ? ` · ${dayNoteLine(note, t)}` : '')}
        {...tappable(a || note ? () => onDay?.(key) : undefined)} />)
    }
    cols.push(<div key={wk} className="hm-col">{cells}</div>)
  }

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeksBack])
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = event => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      el.scrollLeft += event.deltaY
      event.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [weeksBack])

  return <>
    <Segmented value={metric} onChange={changeMetric}
      options={[{ value: 'time', label: t('Time') }, { value: 'vol', label: t('Volume') }]} />
    <div className="hm-wrap" ref={wrapRef}>
      <div className="hm-months" style={{ marginInlineStart: 30 }}>{months}</div>
      <div className="hm-body">
        <div className="hm-days">{dayLabels.map((lbl, i) => <span key={i}>{lbl ? t(lbl) : ''}</span>)}</div>
        <div className="hm-grid">{cols}</div>
      </div>
    </div>
    <div className="hm-legend">{t(metric === 'vol' ? 'Less volume' : 'Less time')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" /><div className="hm-c l3" /><div className="hm-c l4" /> {t(metric === 'vol' ? 'More volume' : 'More time')}</div>
  </>
}
