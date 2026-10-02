import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, SessionUsage } from 'claude-code'

import type { Limit, Percent, Usd } from '../../types'
import type { Meter } from '../meters'

// Everything $.session.usage() reports: context fill, rate-limit windows and
// cost. One feature, because the engine takes one session.start and one
// session.measure hook per plugin.
const contextPercent = atom({ plugin: 'leo-mods', key: 'contextPercent' } as const, null as Percent)
const limits = atom({ plugin: 'leo-mods', key: 'limits' } as const, [] as Limit[])
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)
const limitAlerted = atom({ plugin: 'leo-mods', key: 'limitAlerted' } as const, [] as string[])

const ALERT_AT = 80

const SHORT: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const LONG: Record<string, string> = { five_hour: '5-hour', seven_day: '7-day', spend_limit: 'Spend' }

// The percentages to draw as meters: context fill, then each rate-limit
// window (only on a subscription). Each is left out until it has a reading.
export function usageMeters(context: Percent, windows: Limit[]): Meter[] {
  const meters: Meter[] = context === null ? [] : [{ name: 'ctx', percent: context }]

  return [...meters, ...windows.map(w => ({ name: SHORT[w.kind] ?? w.kind, percent: w.percentUsed }))]
}

// "$0.1268" under a dollar, "$1.09" above.
export function costLabel(total: Usd) {
  if (total === null) {
    return null
  }

  return total < 1 ? `$${total.toFixed(4)}` : `$${total.toFixed(2)}`
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
    $.ui.toast(`${LONG[w.kind] ?? w.kind} limit at ${Math.round(w.percentUsed)}%${resetsIn(w.resetsAt, now)}`, { timeoutMs: 8000 })
  }

  if (fresh.length > 0) {
    await update($, limitAlerted, keys => [...keys, ...fresh.map(w => `${w.kind}@${w.resetsAt}`)].slice(-10))
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

    return result
  })

  on('session.measure', async ($, e, next) => {
    await store($, e)

    return next(e)
  })
}
