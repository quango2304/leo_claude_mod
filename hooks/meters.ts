// How the line is drawn on the desktop: SVG throughout, so every size is ours
// (the app's Text has one font size). The summary (cost over active time and
// agents) at the left; one SVG per meter, its name (left, in the bar's color)
// and reset time (right) over a rounded bar with the number inside. In the
// terminal a meter is a row of blocks. Each meter has its own color until it
// gets high, then amber, then red.

// `text` replaces the drawn percentage and `color` the level color, for a
// meter that isn't a usage percentage (the cache countdown). `detail` is drawn
// dim at the label's right end (when a rate-limit window resets).
export type Meter = { name: string; percent: number; text?: string; color?: string; detail?: string }

// Every size below is a base size times SCALE: change SCALE to grow or shrink
// the whole line at once.
const SCALE = 0.8
const px = (base: number) => Math.round(base * SCALE * 10) / 10

// Every desktop meter has the same size, placeholder or not, so the line never
// moves: wide enough for "week Sat 12:00 PM" over the bar and for "cold · new
// session?" inside it.
const WIDTH = px(116)
const LABEL_PX = px(11)
const LABEL_HEIGHT = px(14)
const GAP = px(3)
const BAR_HEIGHT = px(13)
const NUMBER_PX = px(9.5)
const HEIGHT = LABEL_HEIGHT + GAP + BAR_HEIGHT
// The summary's two rows, as tall as a meter so the line's edges align.
const SUMMARY_PX = px(13)
const SUMMARY_CHAR_PX = px(7.4)
const CELLS = 5
const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
// The reset time's gray, secondary on dark and light backgrounds alike: the
// SVG can't follow the app's theme.
const LABEL_COLOR = '#8e8e93'
const NUMBER_ON_FILL = '#111827'

// Soft 400-weight hues that read on both dark and light backgrounds.
const COLORS: Record<string, string> = {
  context: '#60a5fa',
  '5h': '#a78bfa',
  week: '#2dd4bf',
}

// Active time's color: a soft pink, apart from every meter's hue.
export const ACTIVE_COLOR = '#f9a8d4'

const WARN = '#fbbf24'
const DANGER = '#f87171'

function meterColor(name: string, percent: number) {
  if (percent >= 80) {
    return DANGER
  }

  return percent >= 50 ? WARN : (COLORS[name] ?? '#9ca3af')
}

// Two digits ("05%"), so the line doesn't shift as the numbers change.
export function meterText(meter: Meter) {
  return meter.text ?? `${String(Math.round(meter.percent)).padStart(2, '0')}%`
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function svgText(text: string, attributes: string) {
  return `<text font-family="${FONT}" style="font-variant-numeric: tabular-nums" ${attributes}>${escapeXml(text)}</text>`
}

// The meter as one drawing: the label row (the name in the bar's color), then the bar with its number
// centered inside, in the bar's color over the empty track and near-black
// over the fill (clipped to it), so it reads on both.
export function svgMeter(meter: Meter) {
  const p = Math.min(100, Math.max(0, meter.percent))
  const fill = p === 0 ? 0 : Math.max(BAR_HEIGHT, (WIDTH * p) / 100)
  const r = BAR_HEIGHT / 2
  const top = LABEL_HEIGHT + GAP
  const color = meter.color ?? meterColor(meter.name, p)
  const id = `fill-${meter.name.replace(/[^a-z0-9]/gi, '')}`
  const label = (fillColor: string) => `font-size="${LABEL_PX}" y="${LABEL_HEIGHT - px(3)}" fill="${fillColor}"`
  const number = (fillColor: string) =>
    svgText(meterText(meter), `x="${WIDTH / 2}" y="${top + r}" dy="0.35em" text-anchor="middle" font-size="${NUMBER_PX}" font-weight="600" fill="${fillColor}"`)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<defs><clipPath id="${id}"><rect y="${top}" width="${fill.toFixed(1)}" height="${BAR_HEIGHT}" rx="${r}"/></clipPath></defs>` +
    svgText(meter.name, `x="1" font-weight="600" ${label(color)}`) +
    (meter.detail === undefined ? '' : svgText(meter.detail, `x="${WIDTH - 1}" text-anchor="end" ${label(LABEL_COLOR)}`)) +
    `<rect y="${top}" width="${WIDTH}" height="${BAR_HEIGHT}" rx="${r}" fill="${color}" fill-opacity="0.18"/>` +
    number(color) +
    `<g clip-path="url(#${id})"><rect y="${top}" width="${WIDTH}" height="${BAR_HEIGHT}" fill="${color}"/>${number(NUMBER_ON_FILL)}</g>` +
    `</svg>`
  )
}

// The summary at the line's left: the cost (bold, in its color) over the
// active time (pink) and running agents (gray). Its width follows its longer
// row; text runs from the left edge, so a generous width costs nothing.
export type Summary = { cost: string; costColor: string; active: string; agents: string | null }

export function summaryText(summary: Summary) {
  return [summary.cost, summary.active, summary.agents].filter(Boolean).join(' · ')
}

export function summarySize(summary: Summary) {
  const second = summary.active.length + (summary.agents === null ? 0 : summary.agents.length + 3)

  return { width: Math.ceil(Math.max(summary.cost.length, second) * SUMMARY_CHAR_PX) + 2, height: HEIGHT }
}

export function svgSummary(summary: Summary) {
  const { width } = summarySize(summary)
  const row = `font-size="${SUMMARY_PX}" x="0"`
  const agents = summary.agents === null ? '' : `<tspan fill="${LABEL_COLOR}"> · ${escapeXml(summary.agents)}</tspan>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">` +
    svgText(summary.cost, `${row} y="${HEIGHT / 2 - 2}" font-weight="700" fill="${summary.costColor}"`) +
    `<text font-family="${FONT}" style="font-variant-numeric: tabular-nums" ${row} y="${HEIGHT - 2}" fill="${ACTIVE_COLOR}">${escapeXml(summary.active)}${agents}</text>` +
    `</svg>`
  )
}

// What the drawing says, for a reader that can't see it.
export function meterAlt(meter: Meter) {
  return [meter.name, meterText(meter), meter.detail].filter(Boolean).join(' ')
}

export function textMeter(percent: number) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * CELLS)

  return '▰'.repeat(filled) + '▱'.repeat(CELLS - filled)
}

export const meterSize = { width: WIDTH, height: HEIGHT }

// Until the first response (a new session, before its first turn) the line
// keeps its shape: the same meters at the same size, with empty bars, zeroed
// numbers and a $0.00 cost.
export const PLACEHOLDER_METERS: Meter[] = [
  { name: 'cache', percent: 0, text: '00m', color: '#34d399' },
  { name: 'context', percent: 0 },
  { name: '5h', percent: 0, detail: '0h00m' },
  { name: 'week', percent: 0, detail: '--- -:-- --' },
]

