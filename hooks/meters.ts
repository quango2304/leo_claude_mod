// How a percentage is drawn: a small rounded bar on the desktop (SVG), a row
// of blocks in the terminal. Each meter has its own color until it gets
// high, then amber, then red.

// `text` replaces the drawn percentage and `color` the level color, for a
// meter that isn't a usage percentage (the cache countdown).
export type Meter = { name: string; percent: number; text?: string; color?: string }

const WIDTH = 44
const HEIGHT = 6
const CELLS = 5

// Soft 400-weight hues that read on both dark and light backgrounds.
const COLORS: Record<string, string> = {
  ctx: '#60a5fa',
  '5h': '#a78bfa',
  '7d': '#2dd4bf',
}

const WARN = '#fbbf24'
const DANGER = '#f87171'

function meterColor(name: string, percent: number) {
  if (percent >= 80) {
    return DANGER
  }

  return percent >= 50 ? WARN : (COLORS[name] ?? '#9ca3af')
}

export function meterText(meter: Meter) {
  return meter.text ?? `${Math.round(meter.percent)}%`
}

export function svgMeter(meter: Meter) {
  const p = Math.min(100, Math.max(0, meter.percent))
  const fill = p === 0 ? 0 : Math.max(HEIGHT, (WIDTH * p) / 100)
  const r = HEIGHT / 2
  const color = meter.color ?? meterColor(meter.name, p)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="${r}" fill="${color}" fill-opacity="0.18"/>` +
    `<rect width="${fill.toFixed(1)}" height="${HEIGHT}" rx="${r}" fill="${color}"/>` +
    `</svg>`
  )
}

export function textMeter(percent: number) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * CELLS)

  return '▰'.repeat(filled) + '▱'.repeat(CELLS - filled)
}

export const meterSize = { width: WIDTH, height: HEIGHT }
