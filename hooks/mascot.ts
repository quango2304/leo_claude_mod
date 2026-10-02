// The pixel dog at the desktop line's left. The desktop draws pictures as SVG
// only, and a plain image is transparent but doesn't play SMIL, so she's a
// pixel sprite of colored squares and the animation is a few frames swapped on
// a timer (features/mascot.ts). A frame is a set of eyes, a mouth, a shift and
// a few loose pixels (sparkles, a sweat drop, zzz).

import type { Mood } from '../types'

export const MOOD_LABEL: Record<Mood, string> = {
  idle: 'relaxing',
  typing: 'watching you type',
  working: 'thinking hard',
  done: 'cheering, the turn is done',
  error: 'worried, a tool failed',
  sleeping: 'asleep',
}

// The head is drawn into a 30×26 grid by the functions below (ears, face,
// muzzle, eyes, nose, mouth), outlined automatically, and set two cells in from the corner
// of a 34×30 board, so a hop or a sparkle has room around it.
const HEAD_COLS = 30
const HEAD_ROWS = 26
const MARGIN = 2
const COLS = HEAD_COLS + 2 * MARGIN
const ROWS = HEAD_ROWS + 2 * MARGIN
const PIXEL = 1.3
export const MASCOT_WIDTH = Math.round(COLS * PIXEL)
export const MASCOT_HEIGHT = Math.round(ROWS * PIXEL)

const COLORS: Record<string, string> = {
  o: '#3b2a1e', // outline
  P: '#e9b57d', // fur
  L: '#f6d3a8', // fur shine
  Q: '#b9783f', // eye patch
  V: '#9a5f35', // ears
  C: '#fff1de', // muzzle, blaze
  b: '#ffb3a7', // blush
  E: '#2a1f2d', // eyes, nose, brows
  w: '#ffffff', // shine
  M: '#a8344f', // open mouth
  T: '#ff8fa3', // tongue
  y: '#f6b94d', // sparkles
  c: '#7dd3fc', // sweat
  z: '#9b72e0', // zzz and typing dots
}

type Grid = string[][]
const blank = (cols: number, rows: number): Grid => Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'))
const put = (grid: Grid, x: number, y: number, ch: string) => {
  if (grid[y]?.[x] !== undefined) {
    grid[y]![x] = ch
  }
}

// A rounded square: |dx/a|^n + |dy/b|^n <= 1, for the bob and the face.
const inside = (x: number, y: number, cx: number, cy: number, a: number, b: number, n = 2) =>
  Math.abs((x - cx) / a) ** n + Math.abs((y - cy) / b) ** n <= 1

// A round dark eye with a shine, about 6×7 cells around (cx, cy); the other
// looks are strokes.
function drawEye(grid: Grid, cx: number, cy: number, look: string) {
  const arch = (dx: number, height: number) => Math.round(height * (1 - (dx / 3.4) ** 2))

  if (look === 'blink') {
    for (let dx = -3; dx <= 3; dx++) {
      put(grid, cx + dx, cy + 2, 'E')
    }

    return
  }

  if (look === 'happy' || look === 'sleep') {
    for (let dx = -3; dx <= 3; dx++) {
      const y = look === 'happy' ? cy + 1 - arch(dx, 2) : cy + arch(dx, 2)
      put(grid, cx + dx, y, 'E')
      put(grid, cx + dx, y + 1, 'E')
    }

    return
  }

  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (inside(dx, dy, 0, 0, 3.1, 3.7)) {
        put(grid, cx + dx, cy + dy, 'E')
      }
    }
  }

  // Looking down at the keys: the shine sits low.
  const down = look === 'focus' ? 2 : 0

  for (const [dx, dy] of [[-1, -2], [0, -2], [-1, -1], [0, -1], [1, 2]] as const) {
    put(grid, cx + dx, cy + dy + down, 'w')
  }
}

// The mouth hangs from the nose: a stem, then the smile or the open mouth.
const MOUTHS: Record<string, [number, number, string][]> = {
  smile: [[15, 21, 'E'], [15, 22, 'E'], [13, 23, 'E'], [14, 23, 'E'], [16, 23, 'E'], [17, 23, 'E']],
  grin: [[15, 21, 'E'], ...[13, 14, 15, 16, 17].map((x): [number, number, string] => [x, 22, 'M']), ...[13, 14, 15, 16, 17].map((x): [number, number, string] => [x, 23, 'M']), ...[14, 15, 16].map((x): [number, number, string] => [x, 24, 'T']), [15, 25, 'T']],
  o: [[15, 21, 'E'], ...[14, 15, 16].flatMap((x): [number, number, string][] => [[x, 22, 'M'], [x, 23, 'M']])],
  wavy: [[15, 21, 'E'], [12, 23, 'E'], [13, 22, 'E'], [14, 23, 'E'], [16, 23, 'E'], [17, 22, 'E'], [18, 23, 'E']],
  flat: [[15, 21, 'E'], [13, 22, 'E'], [14, 22, 'E'], [15, 22, 'E'], [16, 22, 'E'], [17, 22, 'E']],
}

// The whole head: floppy ears behind, the face, an eye patch, a blaze and a
// muzzle, then eyes, nose, blush and mouth, and the outline around it all.
function drawHead(eyes: string, mouth: string): Grid {
  const grid = blank(HEAD_COLS, HEAD_ROWS)

  for (let y = 0; y < HEAD_ROWS; y++) {
    for (let x = 0; x < HEAD_COLS; x++) {
      const [px, py] = [x + 0.5, y + 0.5]
      const isEar = inside(px, py, 4.2, 13.5, 4, 9) || inside(px, py, 25.8, 13.5, 4, 9)

      if (isEar) {
        grid[y]![x] = 'V'
      }

      if (inside(px, py, 15, 14, 12.2, 11.4, 2.6)) {
        const isShine = ((px - 10) / 3.5) ** 2 + ((py - 5) / 1.2) ** 2 <= 1
        const isPatch = inside(px, py, 21, 12, 5, 5, 2)
        const isBlaze = Math.abs(px - 15) <= 1 + (py - 2) * 0.12 && py < 14
        grid[y]![x] = isBlaze ? 'C' : isPatch ? 'Q' : isShine ? 'L' : 'P'
      }

      if (inside(px, py, 15, 20, 7.6, 5.4, 2.2) && grid[y]![x] !== '.') {
        grid[y]![x] = 'C'
      }
    }
  }

  for (const cx of [5, 25]) {
    for (let dx = -2; dx <= 2; dx++) {
      if (grid[17]?.[cx + dx] === 'P') {
        grid[17]![cx + dx] = 'b'
      }
    }
  }

  drawEye(grid, 9, 12, eyes)
  drawEye(grid, 21, 12, eyes)

  for (const [dx, dy] of [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]] as const) {
    put(grid, 15 + dx, 17 + dy, 'E')
  }

  put(grid, 14, 17, 'w')

  for (const [x, y, ch] of MOUTHS[mouth]!) {
    put(grid, x, y, ch)
  }

  const filled = grid.map(row => [...row])

  for (let y = 0; y < HEAD_ROWS; y++) {
    for (let x = 0; x < HEAD_COLS; x++) {
      const isEmpty = filled[y]![x] === '.'
      const hasNeighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (filled[y + dy!]?.[x + dx!] ?? '.') !== '.')

      if (isEmpty && hasNeighbor) {
        grid[y]![x] = 'o'
      }
    }
  }

  return grid
}

type Dot = [x: number, y: number, color: string]
type Frame = { eyes: string; mouth: string; dx?: number; dy?: number; dots?: Dot[] }

// Dots are in board cells. A plus sparkle, a 2×2 dot, a teardrop, a "z".
const plus = (x: number, y: number): Dot[] =>
  [[x, y - 2], [x, y - 1], [x - 2, y], [x - 1, y], [x, y], [x + 1, y], [x + 2, y], [x, y + 1], [x, y + 2]].map(([px, py]) => [px!, py!, 'y'] as Dot)
const blob = (x: number, y: number, color: string): Dot[] => [[x, y, color], [x + 1, y, color], [x, y + 1, color], [x + 1, y + 1, color]]
const drop = (x: number, y: number): Dot[] => [[x + 1, y, 'c'], [x, y + 1, 'c'], [x + 1, y + 1, 'c'], [x + 2, y + 1, 'c'], [x, y + 2, 'c'], [x + 1, y + 2, 'c'], [x + 2, y + 2, 'c'], [x + 1, y + 3, 'c']]
const zee = (x: number, y: number): Dot[] =>
  [[x, y], [x + 1, y], [x + 2, y], [x + 1, y + 1], [x, y + 2], [x + 1, y + 2], [x + 2, y + 2]].map(([px, py]) => [px!, py!, 'z'] as Dot)

// Two sparkle sets that swap each frame, so they twinkle around her.
const sparkles = (step: number): Dot[] =>
  step % 2 === 0 ? [...plus(4, 4), ...plus(30, 6)] : [...plus(5, 3), ...plus(29, 4)]

const typingDots = (n: number): Dot[] => Array.from({ length: n }, (_, i) => blob(25 + i * 3, 1, 'z')).flat()

// Each mood's loop, one frame per tick (TICK_MS in features/mascot.ts). Idle
// holds one picture for most ticks, so the line only redraws on the blink.
const IDLE: Frame = { eyes: 'open', mouth: 'smile' }

export const FRAMES: Record<Mood, Frame[]> = {
  idle: [IDLE, IDLE, IDLE, IDLE, IDLE, IDLE, IDLE, { eyes: 'blink', mouth: 'smile' }, IDLE, IDLE],
  typing: [
    { eyes: 'focus', mouth: 'smile', dy: 0, dots: typingDots(1) },
    { eyes: 'focus', mouth: 'smile', dy: 1, dots: typingDots(2) },
    { eyes: 'focus', mouth: 'smile', dy: 0, dots: typingDots(3) },
    { eyes: 'focus', mouth: 'smile', dy: 1, dots: [] },
  ],
  working: [0, 1, 2, 3].map((i): Frame => ({ eyes: 'open', mouth: 'o', dx: i % 2, dots: sparkles(i) })),
  done: [0, 1, 2, 3].map((i): Frame => ({ eyes: 'happy', mouth: 'grin', dy: i % 2 === 0 ? -2 : 0, dots: sparkles(i) })),
  error: [0, 1].map((i): Frame => ({ eyes: 'open', mouth: 'wavy', dx: i, dots: drop(31, 8 + 2 * i) })),
  sleeping: [0, 1, 2, 3].map((i): Frame => ({
    eyes: 'sleep',
    mouth: 'flat',
    dy: i % 2,
    dots: i < 2 ? zee(28, 4) : [...zee(28, 4), ...zee(31, 0)],
  })),
}

// The frame on the board as rows of cell codes.
function rowsOf(frame: Frame) {
  const board = blank(COLS, ROWS)
  const head = drawHead(frame.eyes, frame.mouth)

  head.forEach((row, y) => row.forEach((ch, x) => ch !== '.' && put(board, x + MARGIN + (frame.dx ?? 0), y + MARGIN + (frame.dy ?? 0), ch)))

  for (const [x, y, key] of frame.dots ?? []) {
    put(board, x, y, key)
  }

  return board
}

// One frame as an SVG: runs of one color in a row are one rect; transparent
// where there is no pixel.
export function svgMascot(mood: Mood, index: number) {
  const frames = FRAMES[mood]
  const rects: string[] = []

  rowsOf(frames[index % frames.length]!).forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x]!
      let end = x

      while (row[end + 1] === ch) {
        end += 1
      }

      if (COLORS[ch] !== undefined) {
        rects.push(`<rect x="${+(x * PIXEL).toFixed(2)}" y="${+(y * PIXEL).toFixed(2)}" width="${+((end - x + 1) * PIXEL).toFixed(2)}" height="${+PIXEL.toFixed(2)}" fill="${COLORS[ch]}"/>`)
      }

      x = end + 1
    }
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MASCOT_WIDTH}" height="${MASCOT_HEIGHT}" viewBox="0 0 ${+(COLS * PIXEL).toFixed(2)} ${+(ROWS * PIXEL).toFixed(2)}" shape-rendering="crispEdges">` +
    rects.join('') +
    `</svg>`
  )
}
