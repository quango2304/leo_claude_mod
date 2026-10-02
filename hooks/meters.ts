// How a percentage is drawn: a small rounded bar on the desktop (SVG), a row
// of blocks in the terminal. Neutral until it gets high, then amber, then red.

export type Meter = { name: string; percent: number }

const WIDTH = 44
const HEIGHT = 6
const CELLS = 5

function meterColor(percent: number) {
  if (percent >= 90) {
    return '#ef4444'
  }

  return percent >= 70 ? '#f59e0b' : '#9ca3af'
}

export function svgMeter(percent: number) {
  const p = Math.min(100, Math.max(0, percent))
  const fill = p === 0 ? 0 : Math.max(HEIGHT, (WIDTH * p) / 100)
  const r = HEIGHT / 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="${r}" fill="#9ca3af" fill-opacity="0.25"/>` +
    `<rect width="${fill.toFixed(1)}" height="${HEIGHT}" rx="${r}" fill="${meterColor(p)}"/>` +
    `</svg>`
  )
}

export function textMeter(percent: number) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * CELLS)

  return '▰'.repeat(filled) + '▱'.repeat(CELLS - filled)
}

export const meterSize = { width: WIDTH, height: HEIGHT }
