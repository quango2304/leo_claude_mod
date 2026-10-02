// Draws docs/preview.png, the README's picture of the desktop line, from the
// plugin's own drawing code: the same meters, labels and colors, fed sample
// readings, in the dark and light themes. Run it with `bun scripts/preview.ts`;
// the pre-commit hook (.githooks/pre-commit) runs it when the drawing changes.
//
// Needs Google Chrome (headless) for the screenshot; CHROME overrides its path.
import { plugin } from 'bun'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The features import the engine's state helpers, which only exist inside
// Claude Code; the formatters this script calls never use them.
plugin({
  name: 'claude-code stub',
  setup(build) {
    build.module('claude-code', () => ({
      exports: { atom: () => ({}), read: async () => undefined, update: async () => undefined },
      loader: 'object',
    }))
  },
})

const { activeLabel, agentsLabel } = await import('../hooks/features/activity')
const { cacheMeter, costColor, costLabel, usageMeters } = await import('../hooks/features/usage')
const { meterAlt, meterSize, PLACEHOLDER_METERS, summarySize, summaryText, svgMeter, svgSummary } = await import('../hooks/meters')
type Meter = import('../hooks/meters').Meter

const ROOT = join(import.meta.dir, '..')
const OUT = join(ROOT, 'docs', 'preview.png')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Fixed local times, so the picture only changes when the drawing does.
const now = new Date(2026, 9, 2, 13, 0).getTime()
const at = (date: Date) => date.toISOString()

type Line = { cost: number; activeMs: number; agents: number; meters: Meter[] }

const LINES: Line[] = [
  // A new session, before its first response.
  { cost: 0, activeMs: 0, agents: 0, meters: PLACEHOLDER_METERS },
  // Mid-session.
  {
    cost: 0.13,
    activeMs: 12 * MINUTE,
    agents: 0,
    meters: [
      cacheMeter(42 * MINUTE, HOUR)!,
      ...usageMeters(42, [
        { kind: 'five_hour', percentUsed: 23, resetsAt: at(new Date(now + 80 * MINUTE)) },
        { kind: 'seven_day', percentUsed: 12, resetsAt: at(new Date(2026, 9, 3, 21, 0)) },
      ], now),
    ],
  },
  // Near the limits, the cache gone cold, subagents running.
  {
    cost: 64.2,
    activeMs: 75 * MINUTE,
    agents: 2,
    meters: [
      cacheMeter(0, HOUR)!,
      ...usageMeters(85, [
        { kind: 'five_hour', percentUsed: 92, resetsAt: at(new Date(now + 12 * MINUTE)) },
        { kind: 'seven_day', percentUsed: 64, resetsAt: at(new Date(2026, 9, 7, 9, 30)) },
      ], now),
    ],
  },
]

const THEMES = [
  { name: 'dark', background: '#262626' },
  { name: 'light', background: '#f5f5f5' },
]

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function img(source: string, alt: string, size: { width: number; height: number }) {
  return `<img width="${size.width}" height="${size.height}" alt="${escapeHtml(alt)}" src="data:image/svg+xml;utf8,${encodeURIComponent(source)}">`
}

// The band as register.tsx lays it out: the summary at the left, the meters
// at the right.
function band(line: Line, background: string) {
  const summary = { cost: costLabel(line.cost), costColor: costColor(line.cost), active: activeLabel(line.activeMs), agents: agentsLabel(line.agents) }
  const meters = line.meters.map(m => img(svgMeter(m), meterAlt(m), meterSize(m))).join('')

  return `<div class="band" style="background:${background}">${img(svgSummary(summary), summaryText(summary), summarySize(summary))}<div class="meters">${meters}</div></div>`
}

const BAND_HEIGHT = meterSize(PLACEHOLDER_METERS[0]!).height + 20
const GAP = 10
const PADDING = 16
const WIDTH = 700
const height = PADDING * 2 + THEMES.length * LINES.length * (BAND_HEIGHT + GAP) - GAP

const html =
  `<!doctype html><meta charset="utf-8"><style>` +
  `body{margin:0;padding:${PADDING}px;background:#111;font:13px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-variant-numeric:tabular-nums}` +
  `.band{box-sizing:border-box;height:${BAND_HEIGHT}px;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:0 16px;border-radius:12px;margin-bottom:${GAP}px}` +
  `.meters{display:flex;gap:14px}img{display:block}` +
  `</style>` +
  THEMES.map(t => LINES.map(l => band(l, t.background)).join('')).join('')

const dir = mkdtempSync(join(tmpdir(), 'leo-mods-preview-'))
const page = join(dir, 'preview.html')
await Bun.write(page, html)

const chrome = Bun.spawnSync([
  CHROME,
  '--headless',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  `--window-size=${WIDTH},${height}`,
  `--screenshot=${OUT}`,
  `file://${page}`,
])
rmSync(dir, { recursive: true, force: true })

if (!chrome.success) {
  console.error(`Chrome failed (${CHROME}):\n${chrome.stderr.toString()}`)
  process.exit(1)
}

console.log(`wrote ${OUT}`)
