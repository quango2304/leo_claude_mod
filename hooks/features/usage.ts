import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, SessionUsage, Timer } from 'claude-code'

import type { Limit, Percent, Usd } from '../../types'
import type { Meter } from '../meters'

// Everything $.session.usage() reports (context fill, rate-limit windows,
// cost) and the prompt cache's countdown, which runs off the same measurements.
// One feature, because the engine takes one hook per event per plugin.
const contextPercent = atom({ plugin: 'leo-mods', key: 'contextPercent' } as const, null as Percent)
const limits = atom({ plugin: 'leo-mods', key: 'limits' } as const, [] as Limit[])
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)
const limitAlerted = atom({ plugin: 'leo-mods', key: 'limitAlerted' } as const, [] as string[])
const cacheAt = atom({ plugin: 'leo-mods', key: 'cacheAt' } as const, null as number | null)
const cacheTtlMs = atom({ plugin: 'leo-mods', key: 'cacheTtlMs' } as const, null as number | null)
const cacheLeftMs = atom({ plugin: 'leo-mods', key: 'cacheLeftMs' } as const, null as number | null)
const cacheColdToasted = atom({ plugin: 'leo-mods', key: 'cacheColdToasted' } as const, null as number | null)

// The cache timestamp also goes to $.store, per session, so a restarted or
// resumed session still knows when its cache was last refreshed.
const CACHE_STORE_KEY = 'cacheBySession'
const CACHE_STORE_MAX = 50
const TOAST_MS = 30_000

const ALERT_AT = 80
const CACHE_TICK_MS = 15_000
const HOUR = 3_600_000
const FIVE_MINUTES = 300_000

const SHORT: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const LONG: Record<string, string> = { five_hour: '5-hour', seven_day: '7-day', spend_limit: 'Spend' }

let cacheTimer: Timer | null = null
let isTurnRunning = false

// The percentages to draw as meters: context fill, then each rate-limit
// window (only on a subscription). Each is left out until it has a reading.
export function usageMeters(context: Percent, windows: Limit[]): Meter[] {
  const meters: Meter[] = context === null ? [] : [{ name: 'ctx', percent: context }]

  return [...meters, ...windows.map(w => ({ name: SHORT[w.kind] ?? w.kind, percent: w.percentUsed }))]
}

// The prompt cache as a draining meter: "42m" (or "07m") left, or a red "cold · new
// session?" once it lapsed.
// Null before the first response, or with prompt caching off.
export function cacheMeter(leftMs: number | null, ttlMs: number | null): Meter | null {
  if (leftMs === null || ttlMs === null) {
    return null
  }

  if (leftMs === 0) {
    return { name: 'cache', percent: 0, text: 'cold · new session?', color: '#f87171', isAlert: true }
  }

  const fraction = leftMs / ttlMs
  const minutes = Math.ceil(leftMs / 60_000)
  const color = fraction > 0.4 ? '#34d399' : fraction > 0.15 ? '#fbbf24' : '#f87171'

  return { name: 'cache', percent: fraction * 100, text: `${String(minutes).padStart(2, '0')}m`, color }
}

// The cost's color: green under $50, amber under $100, red from $100.
export function costColor(total: number) {
  if (total >= 100) {
    return '#f87171'
  }

  return total >= 50 ? '#fbbf24' : '#4ade80'
}

// "$0.00", "$1.09": always cents, so the line doesn't shift.
export function costLabel(total: number) {
  return `$${total.toFixed(2)}`
}

function resetsIn(resetsAt: string | undefined, now: number) {
  const ms = resetsAt === undefined ? NaN : Date.parse(resetsAt) - now

  if (!(ms > 0)) {
    return ''
  }

  const minutes = Math.round(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  return days > 0 ? `, resets in ${days}d ${hours}h` : `, resets in ${hours}h ${minutes % 60}m`
}

// Toasts once per window (until it resets) when its usage passes ALERT_AT.
async function alertIfHigh($: EngineInterface, windows: Limit[]) {
  const alerted = await read($, limitAlerted)
  const now = await $.clock.now()
  const fresh = windows.filter(w => w.percentUsed >= ALERT_AT && !alerted.includes(`${w.kind}@${w.resetsAt}`))

  for (const w of fresh) {
    $.ui.toast(`${LONG[w.kind] ?? w.kind} limit at ${Math.round(w.percentUsed)}%${resetsIn(w.resetsAt, now)}`, { timeoutMs: TOAST_MS })
  }

  if (fresh.length > 0) {
    await update($, limitAlerted, keys => [...keys, ...fresh.map(w => `${w.kind}@${w.resetsAt}`)].slice(-10))
  }
}

// The main conversation's cache TTL, decided the way Claude Code decides it:
// the env var, then the promptCacheTtl setting, then 1 hour on a subscription
// within its limits and 5 minutes otherwise. Null with caching off.
async function cacheTtl($: EngineInterface, windows: Limit[]) {
  const fromEnv = await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL')

  if (fromEnv === '1h' || fromEnv === '5m') {
    return fromEnv === '1h' ? HOUR : FIVE_MINUTES
  }

  if (await $.env.get('DISABLE_PROMPT_CACHING')) {
    return null
  }

  const settings = (await $.settings.read()) as { promptCacheTtl?: string }

  if (settings.promptCacheTtl === '1h' || settings.promptCacheTtl === '5m') {
    return settings.promptCacheTtl === '1h' ? HOUR : FIVE_MINUTES
  }

  if (await $.env.get('FORCE_PROMPT_CACHING_5M')) {
    return FIVE_MINUTES
  }

  const isSubscription = windows.length > 0 && windows.every(w => w.percentUsed < 100)

  return isSubscription ? HOUR : FIVE_MINUTES
}

// Recomputes the time left, toasting once when the cache goes cold, and keeps
// a timer running while it's warm.
async function tickCache($: EngineInterface) {
  const at = await read($, cacheAt)
  const ttl = await read($, cacheTtlMs)

  if (at === null || ttl === null) {
    return
  }

  const left = isTurnRunning ? ttl : Math.max(0, at + ttl - (await $.clock.now()))
  await update($, cacheLeftMs, () => left)

  if (left > 0 && cacheTimer === null) {
    cacheTimer = $.clock.every(CACHE_TICK_MS, () => void tickCache($))
  } else if (left === 0) {
    cacheTimer?.cancel()
    cacheTimer = null

    if ((await read($, cacheColdToasted)) !== at) {
      $.ui.toast('Prompt cache expired: your next message re-reads the whole conversation at full price. For a new task, start a new session.', { timeoutMs: TOAST_MS })
      await update($, cacheColdToasted, () => at)
    }
  }
}

type CacheRecord = { at: number; ttl: number | null }

async function saveCache($: EngineInterface, record: CacheRecord) {
  const id = await $.session.id()
  const saved = ((await $.store.get(CACHE_STORE_KEY)) ?? {}) as Record<string, CacheRecord>
  const kept = Object.entries(saved).filter(([key]) => key !== id).slice(-(CACHE_STORE_MAX - 1))
  await $.store.set(CACHE_STORE_KEY, Object.fromEntries([...kept, [id, record]]))
}

// After a restart or resume, picks the cache timestamp back up from $.store.
async function loadCache($: EngineInterface) {
  if ((await read($, cacheAt)) !== null) {
    return
  }

  const saved = ((await $.store.get(CACHE_STORE_KEY)) ?? {}) as Record<string, CacheRecord>
  const record = saved[await $.session.id()]

  if (record !== undefined) {
    await update($, cacheAt, () => record.at)
    await update($, cacheTtlMs, () => record.ttl)
  }
}

async function store($: EngineInterface, usage: Omit<SessionUsage, 'startedAt'>) {
  const percent = usage.context.percent ?? null
  const windows: Limit[] = usage.rateLimits.map(w => ({ ...w }))
  const total = usage.cost?.usd ?? null

  await update($, contextPercent, () => percent)
  await update($, limits, () => windows)
  await update($, costUsd, () => total)
  await alertIfHigh($, windows)
}

export function registerUsage(on: On) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await store($, await $.session.usage())
    await loadCache($)
    await tickCache($)

    return result
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    await tickCache($)

    return next(e)
  })

  // Fires after each main-thread turn: a context change means the main
  // conversation got a response, which restarts the cache's TTL.
  on('session.measure', async ($, e, next) => {
    isTurnRunning = false
    await store($, e)

    if (e.changed.includes('context')) {
      const now = await $.clock.now()
      const ttl = await cacheTtl($, e.rateLimits.map(w => ({ ...w })))
      await update($, cacheAt, () => now)
      await update($, cacheTtlMs, () => ttl)
      await saveCache($, { at: now, ttl })
      await tickCache($)
    }

    return next(e)
  })
}
