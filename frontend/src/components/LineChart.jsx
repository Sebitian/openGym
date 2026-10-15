import { useLayoutEffect, useRef, useState } from 'react'
import { fmtNum, fmtDate, MONTHS, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'

const W = 340   // viewBox width; the svg stretches to its container, height comes from `h`

// A hole longer than about three weeks is time off, not a trend. Fold it down to a
// week of axis so the line shows the blocks that were actually trained, and so month
// ticks do not name months that only existed because of the hole. A skipped week or
// two stays on the real clock. A range filter that never includes such a hole is
// unchanged, because nothing in it is long enough to fold.
const WEEK_MS = 7 * 86400000
const FOLD_AFTER_MS = 3 * WEEK_MS
const FOLDED_GAP_MS = WEEK_MS

function timeAxis(times) {
  const sorted = [...new Set(times.filter(t => Number.isFinite(t)))].sort((a, b) => a - b)
  if (sorted.length < 2) {
    const t0 = sorted[0] ?? 0
    return { toUnit: () => 0.5, span: 0, gaps: [], t0, t1: t0 }
  }
  const gaps = []
  const marks = [{ t: sorted[0], v: 0 }]
  let v = 0
  for (let i = 1; i < sorted.length; i++) {
    const dt = sorted[i] - sorted[i - 1]
    if (dt > FOLD_AFTER_MS) {
      gaps.push([sorted[i - 1], sorted[i]])
      v += FOLDED_GAP_MS
    } else {
      v += dt
    }
    marks.push({ t: sorted[i], v })
  }
  const span = v || 1
  const toUnit = t => {
    if (t <= marks[0].t) return 0
    if (t >= marks[marks.length - 1].t) return 1
    let lo = 0, hi = marks.length - 1
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (marks[mid].t <= t) lo = mid
      else hi = mid
    }
    const a = marks[lo], b = marks[hi]
    const dt = b.t - a.t || 1
    return (a.v + (t - a.t) / dt * (b.v - a.v)) / span
  }
  return { toUnit, span, gaps, t0: sorted[0], t1: sorted[sorted.length - 1] }
}

const inFoldedGap = (t, gaps) => gaps.some(([a, b]) => t > a && t < b)

// Pixels per trained day once a hole is folded. Wide enough that a week's points stay
// separate, and wider than the card so a long history scrolls instead of shrinking.
const PX_PER_DAY = 8
const AXIS_PAD = 46

export function plotWidthFor(points, series) {
  const times = []
  if (points) for (const p of points) if (p && Number.isFinite(p.t)) times.push(p.t)
  if (series) for (const s of series) for (const p of s.points || []) if (p && Number.isFinite(p.t)) times.push(p.t)
  const axis = timeAxis(times)
  if (!(axis.span > 0)) return W
  return Math.max(W, Math.round(axis.span / 86400000 * PX_PER_DAY + AXIS_PAD))
}

// points: [{ t: ms, y: num, d?: iso, m?: 0..1, note?: str }] sorted by t.
//   m    marks the point — a second reading carried by the same dot (bigger and more solid =
//        more of it). Used for effort on the weight curve, where the two belong on one line:
//        the same weight with less left in the tank is not the same session.
//   note extra text for that point's tooltip.
// opts: { h, unit, color, axes, goal, invert, series }
//   invert flips the y axis, for a scale that counts down as it gets harder (RIR). Without it
//   a curve of reps-in-reserve reads upside down, with the hardest sets at the floor.
//   series draws several lines instead of one: [{ points, color }] (issue #145, one per set
//   number). `points` then only anchors the hover — one per date, its `note` the tooltip — and
//   the y axis spans every series.
export default function LineChart({ points, h = 150, unit = '', color = 'var(--acc)', axes = true, goal = null, invert = false, series = null, viewWidth = null, wide = false }) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const tipRef = useRef(null)
  const [hover, setHover] = useState(null)   // { x, y, iso, v }
  // `wide` sizes the viewBox to the trained span so strokes stay the same size as a
  // card chart. The exercise-progress scroller is what makes that width reachable.
  const plotW = wide ? plotWidthFor(points, series) : Math.max(W, Math.round(Number(viewWidth)) || 0)

  // A new dataset has different coordinates and meaning, so never carry the previous
  // point selection into it. Layout timing removes the marker before the new chart paints.
  useLayoutEffect(() => {
    setHover(null)
  }, [points])

  // The tooltip is placed after layout, from its measured size, because the chart
  // lives in an overflow-clipped box: a fixed half-width offset (what this used to
  // do) hangs the label off the edge on the first and last point, and the clip then
  // eats it. Reading offsetWidth here also covers translated labels, which are not
  // all the same length. Writing straight to the node's style keeps this off the
  // render path — hover fires on every mouse move.
  useLayoutEffect(() => {
    const tip = tipRef.current, wrap = wrapRef.current
    if (!hover || !tip || !wrap) return
    const cw = wrap.clientWidth, ch = wrap.clientHeight
    const tw = tip.offsetWidth, th = tip.offsetHeight
    const M = 4                                   // breathing room against the clip
    const cx = hover.x / plotW * cw, cy = hover.y / h * ch
    tip.style.left = Math.max(M, Math.min(cw - tw - M, cx - tw / 2)) + 'px'
    // Parked at the top, but dropped below the point when the point sits high
    // enough that the label would cover the very value it is reporting.
    tip.style.top = (cy < th + 14 ? Math.min(ch - th - M, cy + 14) : M) + 'px'
  })

  if (!points || points.length === 0) return <div className="empty small">{t('No data yet')}</div>
  const H = h
  const P = { l: axes ? 34 : 8, r: 12, t: 10, b: axes ? 22 : 8 }
  const single = points.length === 1
  const pts = single ? [points[0], points[0]] : points
  const multi = Array.isArray(series) && series.length > 0
  const ys = multi ? series.flatMap(s => s.points.map(p => p.y)) : pts.map(p => p.y)
  let ymin = Math.min(...ys), ymax = Math.max(...ys)
  if (goal != null && isFinite(goal)) { ymin = Math.min(ymin, goal); ymax = Math.max(ymax, goal) }
  if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad
  const axisTimes = []
  for (const p of pts) axisTimes.push(p.t)
  if (multi) for (const s of series) for (const p of s.points) axisTimes.push(p.t)
  const axis = timeAxis(axisTimes)
  const t0 = axis.t0, t1 = axis.t1
  const X = t => (axis.span === 0 ? (P.l + plotW - P.r) / 2 : P.l + axis.toUnit(t) * (plotW - P.l - P.r))
  const Y = y => {
    const f = (y - ymin) / (ymax - ymin)
    return P.t + (invert ? f : 1 - f) * (H - P.t - P.b)
  }

  const gridlines = []
  if (axes) {
    const range = ymax - ymin, raw = range / 3
    const pow = Math.pow(10, Math.floor(Math.log10(raw)))
    let step = 10 * pow
    for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) { step = m * pow; break }
    for (let v0 = Math.ceil(ymin / step) * step; v0 <= ymax + 1e-9; v0 += step) {
      // Snapped to the step, so adding it up never drifts, and `|| 0` turns the -0 that
      // Math.ceil gives a range just under zero into a plain 0 instead of a "-0" label.
      const v = Math.round(v0 / step) * step || 0
      const y = Y(v)
      gridlines.push(<g key={'y' + v}>
        <line x1={P.l} y1={y} x2={plotW - P.r} y2={y} stroke="var(--sep-op)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={P.l - 5} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="var(--label-2)">{fmtNum(v)}</text>
      </g>)
    }
    const d0 = new Date(t0), d1 = new Date(t1)
    const spanYears = d0.getFullYear() !== d1.getFullYear()
    // Year on the wide chart only. The card-width axis keeps "Sep" so a folded hole
    // still reads as month names, and a scrolled history can show 2025 next to 2026.
    const withYear = spanYears && plotW > W
    const monthLabel = date => withYear ? t(MONTHS[date.getMonth()]) + ' ' + date.getFullYear() : t(MONTHS[date.getMonth()])
    const ticks = []
    let m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1)
    while (m <= d1) {
      const tv = +m
      // A month that falls inside a folded hole has no point to name.
      if (!inFoldedGap(tv, axis.gaps)) ticks.push({ t: tv, txt: monthLabel(m) })
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    }
    if (ticks.length === 0 && !single) {
      for (let i = 0; i <= 2; i++) {
        const tv = t0 + (t1 - t0) * i / 2
        if (inFoldedGap(tv, axis.gaps)) continue
        const dd = new Date(tv)
        ticks.push({ t: tv, txt: dd.getDate() + ' ' + monthLabel(dd), anchor: i === 0 ? 'start' : i === 2 ? 'end' : 'middle' })
      }
    }
    // The first session can sit in a month whose later boundary falls inside a folded
    // hole, so the loop above never names that year. Pin the opening month on the wide axis.
    if (withYear && !single) {
      const iso = pts[0].d
      const startDate = iso ? new Date(iso + 'T12:00:00') : d0
      const startLabel = monthLabel(startDate)
      if (!ticks.some(tk => tk.txt === startLabel)) ticks.unshift({ t: t0, txt: startLabel, anchor: 'start' })
    }
    const slots = plotW > W ? Math.max(7, Math.floor((plotW - P.l - P.r) / 88)) : 7
    const every = Math.max(1, Math.ceil(ticks.length / slots))
    ticks.forEach((tk, i) => {
      if (i % every) return
      const x = X(tk.t)
      gridlines.push(<g key={'x' + i}>
        <line x1={x} y1={P.t} x2={x} y2={H - P.b} stroke="var(--sep-op)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={x} y={H - 7} textAnchor={tk.anchor || 'middle'} fontSize="9.5" fill="var(--label-2)">{tk.txt}</text>
      </g>)
    })
  }

  const poly = pts.map(p => X(p.t).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')
  const last = pts[pts.length - 1]
  const gid = 'g' + Math.round(t0 % 1e7) + '_' + H
  const hoverSource = single ? [points[0]] : points
  const hoverDates = hoverSource.map(p => p.d || isoOf(new Date(p.t)))
  const showYear = new Set(hoverDates.map(iso => new Date(iso + 'T12:00:00').getFullYear())).size > 1
  const hoverPts = hoverSource.map((p, i) => ({ x: X(p.t), y: Y(p.y), t: p.t, iso: hoverDates[i], v: p.y, note: p.note }))
  const marked = points.some(p => p.m != null)

  const onMove = e => {
    const c = e.touches ? e.touches[0] : e
    if (!c || c.clientX === undefined) return
    const r = svgRef.current.getBoundingClientRect()
    const w = r.width || plotW
    const vx = (c.clientX - r.left) / w * plotW
    let best = hoverPts[0]
    hoverPts.forEach(p => { if (Math.abs(p.x - vx) < Math.abs(best.x - vx)) best = p })
    setHover(best)
  }

  return (
    <div className="chart-i" ref={wrapRef} style={plotW > W ? { width: plotW } : undefined}
      onMouseMove={onMove} onMouseDown={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove}>
      <svg ref={svgRef} viewBox={`0 0 ${plotW} ${H}`} preserveAspectRatio="none" style={{ aspectRatio: `${plotW}/${H}` }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        {gridlines}
        {goal != null && isFinite(goal) && <>
          <line x1={P.l} y1={Y(goal)} x2={plotW - P.r} y2={Y(goal)} stroke="var(--yellow)" strokeWidth="1.6" strokeDasharray="7 4" />
          <text x={plotW - P.r - 2} y={Y(goal) - 5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="var(--yellow)">{fmtNum(goal)}</text>
        </>}
        {/* The first series is drawn widest and underneath, each next one thinner on top, so
            lines that share their values show as nested stripes instead of hiding each other. */}
        {multi ? series.map((s, k) => {
          const sw = 2 + (series.length - 1 - k) * 2.4
          return <g key={'s' + k}>
            {s.points.length > 1 && <polyline points={s.points.map(p => X(p.t).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')}
              fill="none" stroke={s.color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />}
            {s.points.map((p, i) => <circle key={i} cx={X(p.t)} cy={Y(p.y)} r={sw / 2 + 1.2} fill={s.color} />)}
          </g>
        }) : <>
          <polygon points={`${P.l},${H - P.b} ${poly} ${X(last.t).toFixed(1)},${H - P.b}`} fill={`url(#${gid})`} />
          <polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {marked && pts.map((p, i) => (p.m == null ? null :
            <circle key={'m' + i} cx={X(p.t)} cy={Y(p.y)} r={2.4 + p.m * 3} fill={color} opacity={0.3 + p.m * 0.7} />))}
          <circle cx={X(last.t)} cy={Y(last.y)} r="4" fill={color} />
        </>}
        {hover && <g>
          <line className="cvl" x1={hover.x} y1={P.t} x2={hover.x} y2={H - P.b} stroke="var(--label-3)" strokeWidth="1" strokeDasharray="3 3" />
          {multi
            ? series.map((s, k) => s.points.filter(p => p.t === hover.t).map((p, i) =>
              <circle key={k + '_' + i} cx={X(p.t)} cy={Y(p.y)} r="4.5" fill={s.color} stroke="var(--bg)" strokeWidth="2" />))
            : <>
              <line className="chl" x1={P.l} y1={hover.y} x2={plotW - P.r} y2={hover.y} stroke="var(--label-3)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hover.x} cy={hover.y} r="5" fill={color} stroke="var(--bg)" strokeWidth="2" />
            </>}
        </g>}
      </svg>
      {hover && <div className="ctip" ref={tipRef}>
        {multi
          ? <>{fmtDate(hover.iso, true, showYear)}{hover.note ? ' · ' + hover.note : ''}</>
          : <>{fmtDate(hover.iso, true, showYear)} · {fmtNum(hover.v)}{unit ? ' ' + unit : ''}{hover.note ? ' · ' + hover.note : ''}</>}
      </div>}
    </div>
  )
}