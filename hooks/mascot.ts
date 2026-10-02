// The pixel dog at the desktop line's left. The desktop draws pictures as SVG
// only, and a plain image is transparent but doesn't play SMIL, so she's a
// pixel sprite of colored squares and the animation is a few frames swapped on
// a timer (features/mascot.ts). The head is drawn in code (ears, face, muzzle,
// eyes, brows, nose, mouth) with an automatic outline; a frame is a look, a
// pair of ears, a shift and a few loose pixels (a "?", hearts, zzz).

import type { Mood } from '../types'

export const MOOD_LABEL: Record<Mood, string> = {
  idle: 'dozing',
  typing: 'listening to you type',
  working: 'working',
  done: 'cheering, the turn is done',
}

// The head is drawn into a 34×26 grid, set into a 40×30 board: three cells
// each side for the ears' room and the loose pixels, two above and below.
const HEAD_COLS = 34
const HEAD_ROWS = 26
const MARGIN_X = 3
const MARGIN_Y = 2
const COLS = HEAD_COLS + 2 * MARGIN_X
const ROWS = HEAD_ROWS + 2 * MARGIN_Y
const PIXEL = 1.3
export const MASCOT_WIDTH = Math.round(COLS * PIXEL)
export const MASCOT_HEIGHT = Math.round(ROWS * PIXEL)

const COLORS: Record<string, string> = {
  o: '#3b2a1e', // outline
  P: '#e9b57d', // fur
  L: '#f6d3a8', // fur shine
  Q: '#b9783f', // eye patch
  V: '#9a5f35', // ears
  U: '#c98a5a', // inner ears
  C: '#fff1de', // muzzle, blaze
  b: '#ffb3a7', // blush
  E: '#2a1f2d', // pupils, nose, lashes
  I: '#7a4d2a', // iris
  B: '#4a2e1a', // brows
  w: '#ffffff', // shine
  M: '#a8344f', // open mouth
  T: '#ff8fa3', // tongue
  y: '#f6b94d', // sparkles, the "?"
  r: '#fb7185', // hearts
  c: '#7dd3fc', // sweat
  z: '#9b72e0', // zzz and dots
  d: '#6b6f85', // dim dots
}

type Grid = string[][]
const blank = (cols: number, rows: number): Grid => Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'))
const put = (grid: Grid, x: number, y: number, ch: string) => {
  if (grid[y]?.[x] !== undefined) {
    grid[y]![x] = ch
  }
}

// A rounded square: |dx/a|^n + |dy/b|^n <= 1, for the face and the ears.
const inside = (x: number, y: number, cx: number, cy: number, a: number, b: number, n = 2) =>
  Math.abs((x - cx) / a) ** n + Math.abs((y - cy) / b) ** n <= 1

type Eyes = 'open' | 'wide' | 'narrow' | 'blink' | 'happy' | 'sleep'
type Brows = 'none' | 'raised' | 'worried' | 'focus' | 'think'
type Mouth = 'smile' | 'grin' | 'tongue' | 'yawn' | 'o' | 'pantA' | 'pantB' | 'sad' | 'flat' | 'tiny'
type Dot = [x: number, y: number, color: string]
type Frame = { eyes: Eyes; wink?: boolean; look?: [number, number]; brows?: Brows; mouth: Mouth; ears?: number | [left: number, right: number]; dx?: number; dy?: number; dots?: Dot[] }

const CX = 17 // the face's center column
const EYE_Y = 12
const EYE_X = [11, 23]

// An eye around (cx, EYE_Y): brown iris, dark pupil that follows `look`, and
// a shine; or a stroke when it is shut.
function drawEye(grid: Grid, cx: number, eyes: Eyes, look: [number, number]) {
  const arch = (dx: number, height: number) => Math.round(height * (1 - (dx / 3.4) ** 2))

  if (eyes === 'blink') {
    for (let dx = -3; dx <= 3; dx++) {
      put(grid, cx + dx, EYE_Y + 2, 'E')
    }

    return
  }

  if (eyes === 'happy' || eyes === 'sleep') {
    for (let dx = -3; dx <= 3; dx++) {
      const y = eyes === 'happy' ? EYE_Y + 1 - arch(dx, 2) : EYE_Y + arch(dx, 2)
      put(grid, cx + dx, y, 'E')
      put(grid, cx + dx, y + 1, 'E')
    }

    return
  }

  const isNarrow = eyes === 'narrow'
  const isWide = eyes === 'wide'
  const [lx, ly] = look
  const [ry, py] = isNarrow ? [2.5, 1] : isWide ? [4.5, 0] : [3.7, 0]
  const [pry, pcy] = isNarrow ? [1.7, 1] : isWide ? [3.5, 0] : [2.9, 0]

  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (inside(dx, dy, 0, py, 3.2, ry)) {
        put(grid, cx + dx, EYE_Y + dy, 'I')
      }

      if (inside(dx, dy, lx, pcy + ly * (isNarrow ? 0 : 1), 2.3, pry)) {
        put(grid, cx + dx, EYE_Y + dy, 'E')
      }
    }
  }

  if (isNarrow) {
    for (let dx = -3; dx <= 3; dx++) {
      put(grid, cx + dx, EYE_Y - 1, 'E')
    }
  }

  const [sx, sy] = [cx + lx, EYE_Y + (isNarrow ? 1 : ly)]
  const shine: [number, number][] = isNarrow ? [[-1, 0], [0, 0]] : isWide ? [[-1, -3], [0, -3], [-1, -2], [0, -2], [-1, -1], [1, 2], [1, 1]] : [[-1, -2], [0, -2], [-1, -1], [0, -1], [1, 2]]

  for (const [dx, dy] of shine) {
    put(grid, sx + dx, sy + dy, 'w')
  }
}

// The left eye's brow as offsets from the eye; the inner end is at +dx, and
// the right eye mirrors it.
const BROWS: Record<Exclude<Brows, 'none' | 'think'>, [number, number][]> = {
  raised: [[-2, -6], [-1, -7], [0, -7], [1, -7], [2, -6]],
  worried: [[-2, -5], [-1, -6], [0, -6], [1, -7], [2, -8]],
  focus: [[-2, -8], [-1, -7], [0, -7], [1, -6], [2, -5]],
}

function drawBrows(grid: Grid, brows: Brows) {
  if (brows === 'none') {
    return
  }

  EYE_X.forEach((cx, side) => {
    const shape = brows === 'think' ? (side === 0 ? BROWS.raised : [[-2, -5], [-1, -5], [0, -5], [1, -5], [2, -5]] as [number, number][]) : BROWS[brows]

    for (const [dx, dy] of shape) {
      put(grid, cx + (side === 0 ? dx : -dx), EYE_Y + dy, 'B')
    }
  })
}

// The mouth hangs from the nose: a stem, then a line or an open mouth, as
// [offset from the center column, row, color].
const MOUTHS: Record<Mouth, [number, number, string][]> = {
  smile: [[0, 21, 'E'], [0, 22, 'E'], [-2, 23, 'E'], [-1, 23, 'E'], [1, 23, 'E'], [2, 23, 'E']],
  tongue: [[0, 21, 'E'], [-2, 22, 'E'], [-1, 22, 'E'], [0, 22, 'T'], [1, 22, 'E'], [2, 22, 'E'], ...[-1, 0, 1].map((x): [number, number, string] => [x, 23, 'T'])],
  yawn: [[0, 21, 'E'], ...[-2, -1, 0, 1, 2].map((x): [number, number, string] => [x, 22, 'M']), ...[-3, -2, -1, 0, 1, 2, 3].map((x): [number, number, string] => [x, 23, 'M']), ...[-2, -1, 0, 1, 2].map((x): [number, number, string] => [x, 24, Math.abs(x) <= 1 ? 'T' : 'M'])],
  grin: [[0, 21, 'E'], ...[-2, -1, 0, 1, 2].flatMap((x): [number, number, string][] => [[x, 22, 'M'], [x, 23, 'M']]), ...[-1, 0, 1].map((x): [number, number, string] => [x, 24, 'T']), [0, 25, 'T']],
  o: [[0, 21, 'E'], ...[-1, 0, 1].flatMap((x): [number, number, string][] => [[x, 22, 'M'], [x, 23, 'M']])],
  pantA: [[0, 21, 'E'], ...[-2, -1, 0, 1, 2].map((x): [number, number, string] => [x, 22, 'M']), ...[-1, 0, 1].flatMap((x): [number, number, string][] => [[x, 23, 'T'], [x, 24, 'T']])],
  pantB: [[0, 21, 'E'], ...[-2, -1, 0, 1, 2].map((x): [number, number, string] => [x, 22, 'M']), ...[-1, 0, 1].flatMap((x): [number, number, string][] => [[x, 23, 'T'], [x, 24, 'T'], [x, 25, 'T']])],
  sad: [[0, 21, 'E'], [-1, 22, 'E'], [1, 22, 'E'], [-2, 23, 'E'], [2, 23, 'E'], [-3, 24, 'E'], [3, 24, 'E']],
  flat: [[0, 21, 'E'], [-2, 22, 'E'], [-1, 22, 'E'], [0, 22, 'E'], [1, 22, 'E'], [2, 22, 'E']],
  tiny: [[0, 21, 'E'], [-1, 22, 'E'], [0, 22, 'E'], [1, 22, 'E']],
}

// The whole head: floppy ears behind (`earDy` lifts or drops them), the face,
// an eye patch, a blaze and a muzzle, then eyes, brows, nose, blush and mouth,
// and the outline around it all.
function drawHead(frame: Frame): Grid {
  const grid = blank(HEAD_COLS, HEAD_ROWS)
  const [earLeft, earRight] = Array.isArray(frame.ears) ? frame.ears : [frame.ears ?? 0, frame.ears ?? 0]

  for (let y = 0; y < HEAD_ROWS; y++) {
    for (let x = 0; x < HEAD_COLS; x++) {
      const [px, py] = [x + 0.5, y + 0.5]

      if (inside(px, py, 5, 13.5 + earLeft, 4.3, 9.3) || inside(px, py, 29, 13.5 + earRight, 4.3, 9.3)) {
        grid[y]![x] = inside(px, py, 3, 14.5 + earLeft, 1.7, 6.3) || inside(px, py, 31, 14.5 + earRight, 1.7, 6.3) ? 'U' : 'V'
      }

      if (inside(px, py, CX, 14, 12.2, 11.4, 2.6)) {
        const isShine = ((px - 12) / 3.5) ** 2 + ((py - 5) / 1.2) ** 2 <= 1
        const isPatch = inside(px, py, 23, 12, 5, 5, 2)
        const isBlaze = Math.abs(px - CX) <= 1 + (py - 2) * 0.12 && py < 14
        grid[y]![x] = isBlaze ? 'C' : isPatch ? 'Q' : isShine ? 'L' : 'P'
      }

      if (inside(px, py, CX, 20, 7.6, 5.4, 2.2) && grid[y]![x] !== '.' && grid[y]![x] !== 'V' && grid[y]![x] !== 'U') {
        grid[y]![x] = 'C'
      }
    }
  }

  for (const cx of [7, 27]) {
    for (let dx = -2; dx <= 2; dx++) {
      if (grid[17]?.[cx + dx] === 'P') {
        grid[17]![cx + dx] = 'b'
      }
    }
  }

  EYE_X.forEach((cx, side) => drawEye(grid, cx, frame.wink === true && side === 1 ? 'happy' : frame.eyes, frame.look ?? [0, 0]))

  drawBrows(grid, frame.brows ?? 'none')

  for (const [dx, dy] of [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]] as const) {
    put(grid, CX + dx, 17 + dy, 'E')
  }

  put(grid, CX - 1, 17, 'w')

  for (const [dx, y, ch] of MOUTHS[frame.mouth]) {
    put(grid, CX + dx, y, ch)
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

// Loose pixels live in the board's right margin (cells 37-39) and its corners.
const shape = (rows: string[], x: number, y: number, color: string): Dot[] =>
  rows.flatMap((row, dy) => [...row].flatMap((ch, dx): Dot[] => (ch === '#' ? [[x + dx, y + dy, color]] : [])))

const HEART = ['#.#', '###', '.#.']
const Z = ['###', '.#.', '###']
const DROP = ['.#.', '###', '###', '.#.']
const PLUS = ['.#.', '###', '.#.']
const BUBBLE = ['.##.', '#..#', '#..#', '.##.']

const hearts = (step: number) => [...shape(HEART, 37, 14 - 3 * (step % 4), 'r'), ...shape(HEART, 0, 8 - 2 * ((step + 2) % 4), 'r')]
const sparkle = (step: number) => (step % 2 === 0 ? [...shape(PLUS, 0, 3, 'y'), ...shape(PLUS, 37, 10, 'y')] : [...shape(PLUS, 1, 1, 'y'), ...shape(PLUS, 36, 12, 'y')])
const drop = (fall: number) => shape(DROP, 37, 5 + fall * 3, 'c')
const thought = (lit: number) => [[38, 9, 1], [37, 5, 2], [37, 0, 3]].flatMap(([x, y, size], i) => shape(Array.from({ length: size! }, () => '#'.repeat(size!)), x!, y!, i === lit ? 'z' : 'd'))
const typingDots = (n: number) => Array.from({ length: n }, (_, i) => shape(['##', '##'], 37, 8 - i * 3, 'z')).flat()
const bubble = (step: number) => (step === 1 ? shape(['##', '##'], 24, 21, 'c') : step === 2 ? shape(BUBBLE, 24, 20, 'c') : [])
const zees = (step: number) => [...shape(Z, 37, 9 - (step % 2), 'z'), ...(step >= 2 ? shape(Z, 36, 3, 'z') : [])]

// Each mood's loop, one frame per FRAME_TICKS of the timer (features/mascot.ts).

export const FRAMES: Record<Mood, Frame[]> = {
  // Dozing: eyes shut, slow breathing, zzz and a snot bubble.
  idle: [0, 1, 2, 3, 4, 5].map((i): Frame => ({ eyes: 'sleep', mouth: i % 3 === 2 ? 'flat' : 'tiny', ears: 3, dy: i < 3 ? 0 : 1, dots: [...zees(i % 4), ...bubble(i % 3)] })),
  // Listening: one ear straight up to hear, eyes up and thoughtful.
  typing: [0, 1, 2, 3, 4, 5, 6, 7].map((i): Frame => ({
    eyes: i === 6 ? 'blink' : 'open',
    look: i < 4 ? [-1, -1] : [1, -1],
    brows: 'think',
    mouth: i % 4 === 3 ? 'tiny' : 'flat',
    dx: i < 4 ? 0 : 1,
    ears: [-4, 0],
    dots: thought(i % 4),
  })),
  working: [0, 1, 2, 3, 4, 5].map((i): Frame => ({ eyes: 'narrow', look: [[-1, 0, 1, 0, -1, 1][i]!, 0], brows: 'focus', mouth: i % 2 === 0 ? 'pantA' : 'pantB', dy: i % 2, ears: i % 2 === 0 ? 0 : 2, dots: [...sparkle(i), ...(i % 3 === 2 ? drop(i % 2) : [])] })),
  done: [0, 1, 2, 3, 4, 5, 6, 7].map((i): Frame => ({ eyes: 'happy', mouth: i % 4 < 2 ? 'grin' : 'tongue', ears: i % 2 === 0 ? -1 : 3, dy: [0, -3, -5, -3, 0, -3, -5, -3][i]!, dx: i % 4 === 1 ? -1 : i % 4 === 3 ? 1 : 0, dots: [...hearts(i), ...sparkle(i)] })),
}

// Ticks (features/mascot.ts) each frame of a mood stays: the lively moods step
// fast, a sleeping dog breathes slowly.
export const FRAME_TICKS: Record<Mood, number> = {
  idle: 3,
  typing: 2,
  working: 1,
  done: 1,
}

// The frame on the board as rows of cell codes.
function rowsOf(frame: Frame) {
  const board = blank(COLS, ROWS)

  drawHead(frame).forEach((row, y) => row.forEach((ch, x) => ch !== '.' && put(board, x + MARGIN_X + (frame.dx ?? 0), y + MARGIN_Y + (frame.dy ?? 0), ch)))

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
