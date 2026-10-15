// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LineChart from './LineChart.jsx'
import { fmtDate, isoOf } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const point = (year, month, day, y) => ({
  d: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  t: new Date(year, month - 1, day, 12).getTime(),
  y
})

const firstPoints = [
  { t: Date.UTC(2026, 0, 1), y: 80, d: '2026-01-01' },
  { t: Date.UTC(2026, 0, 15), y: 82, d: '2026-01-15' },
]
const nextPoints = [
  { t: Date.UTC(2026, 1, 1), y: 78, d: '2026-02-01' },
  { t: Date.UTC(2026, 1, 15), y: 79, d: '2026-02-15' },
]

function renderChart(points) {
  act(() => root.render(<LineChart points={points} axes={false} unit="kg" />))
}

function hoverAt(clientX) {
  act(() => {
    container.querySelector('.chart-i').dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX }))
  })
  return container.querySelector('.ctip').textContent
}

describe('LineChart hover date', () => {
  it('keeps same-year points in the compact format', () => {
    const first = point(2026, 1, 15, 70)
    renderChart([first, point(2026, 2, 15, 71)])

    expect(hoverAt(0)).toBe(`${fmtDate(first.d, true)} · 70 kg`)
  })

  it('includes the calendar year at a short cross-year boundary', () => {
    const first = point(2025, 11, 30, 70)
    const last = point(2026, 2, 1, 71)
    renderChart([first, last])

    expect(hoverAt(0)).toBe(`${fmtDate(first.d, true, true)} · 70 kg`)
    expect(hoverAt(340)).toBe(`${fmtDate(last.d, true, true)} · 71 kg`)
  })

  it('keeps a single point compact', () => {
    const only = point(2026, 7, 4, 70)
    renderChart([only])

    expect(hoverAt(170)).toBe(`${fmtDate(only.d, true)} · 70 kg`)
  })

  it('uses timestamp-only points when deciding whether to show the year', () => {
    const first = point(2025, 12, 31, 70)
    const last = point(2026, 1, 1, 71)
    const timestampOnly = [{ t: first.t, y: first.y }, { t: last.t, y: last.y }]
    renderChart(timestampOnly)

    const lastIso = isoOf(new Date(last.t))
    expect(hoverAt(340)).toBe(`${fmtDate(lastIso, true, true)} · 71 kg`)
  })
})

describe('LineChart hover state', () => {
  it('clears the tooltip and hover markers when points are replaced, then allows hovering again', () => {
    renderChart(firstPoints)
    hoverAt(170)

    expect(container.querySelector('.ctip')).toBeTruthy()
    expect(container.querySelector('.cvl')).toBeTruthy()
    expect(container.querySelector('.chl')).toBeTruthy()

    renderChart(nextPoints)

    expect(container.querySelector('.ctip')).toBeNull()
    expect(container.querySelector('.cvl')).toBeNull()
    expect(container.querySelector('.chl')).toBeNull()

    hoverAt(170)
    expect(container.querySelector('.ctip')).toBeTruthy()
    expect(container.querySelector('.cvl')).toBeTruthy()
  })
})

function polylineXs() {
  return container.querySelector('polyline').getAttribute('points').trim().split(/\s+/).map(p => Number(p.split(',')[0]))
}

function xLabels() {
  return [...container.querySelectorAll('text')]
    .filter(n => Number(n.getAttribute('y')) > 130)
    .map(n => n.textContent)
}

describe('LineChart empty stretches', () => {
  it('keeps a skipped week or two on the real clock', () => {
    const start = new Date(2026, 7, 31, 12).getTime()
    const day = 86400000
    act(() => root.render(<LineChart axes={false} points={[
      { t: start, y: 1 },
      { t: start + 7 * day, y: 2 },
      { t: start + 21 * day, y: 3 },
      { t: start + 28 * day, y: 4 },
    ]} />))
    const xs = polylineXs()
    const gaps = [xs[1] - xs[0], xs[2] - xs[1], xs[3] - xs[2]]
    expect(gaps[1] / gaps[0]).toBeGreaterThan(1.8)
    expect(gaps[1] / gaps[0]).toBeLessThan(2.2)
  })

  it('folds a multi-month hole so empty months are not the axis', () => {
    const weeks = []
    const add = (y, m, d, v) => weeks.push(point(y, m, d, v))
    for (let i = 0; i < 8; i++) add(2025, 10, 6 + i * 7, 70 + i)
    add(2026, 8, 3, 80)
    add(2026, 8, 10, 81)
    add(2026, 8, 17, 82)
    add(2026, 8, 24, 83)
    add(2026, 8, 31, 84)
    add(2026, 9, 21, 85)
    add(2026, 9, 28, 86)
    add(2026, 10, 5, 87)
    act(() => root.render(<LineChart points={weeks} axes unit="kg" />))

    const labels = xLabels()
    expect(labels).not.toContain('Feb')
    expect(labels).not.toContain('Apr')
    expect(labels).not.toContain('Jun')
    expect(labels.some(l => l === 'Sep' || l === 'Oct' || l === 'Nov')).toBe(true)

    const xs = polylineXs()
    const before = xs[7]
    const after = xs[8]
    const span = xs[xs.length - 1] - xs[0]
    expect((after - before) / span).toBeLessThan(0.15)
    expect(after).toBeGreaterThan(before)
  })

  it('leaves a range that never includes the hole on a linear axis', () => {
    act(() => root.render(<LineChart axes={false} points={[
      point(2026, 8, 3, 80),
      point(2026, 8, 10, 81),
      point(2026, 8, 17, 82),
      point(2026, 8, 24, 83),
    ]} />))
    const xs = polylineXs()
    const gaps = [xs[1] - xs[0], xs[2] - xs[1], xs[3] - xs[2]]
    expect(gaps[1] / gaps[0]).toBeGreaterThan(0.9)
    expect(gaps[1] / gaps[0]).toBeLessThan(1.1)
  })
})

describe('LineChart y axis', () => {
  it('labels the zero line 0, never -0, when the range dips just below zero', () => {
    act(() => root.render(<LineChart points={[point(2026, 1, 1, 70), point(2026, 1, 8, 9999)]} axes unit="kg" />))
    const labels = [...container.querySelectorAll('text')].map(n => n.textContent)
    expect(labels).toContain('0')
    expect(labels.some(l => /^[-\u2212]0$/.test(l))).toBe(false)
  })
})
