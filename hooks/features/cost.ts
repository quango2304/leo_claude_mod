import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Usd } from '../../types'

const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)

// This feature's footer label, or null to leave it out.
export function costLabel(total: Usd) {
  if (total === null) {
    return null
  }

  return total < 1 ? `$${total.toFixed(4)}` : `$${total.toFixed(2)}`
}

export function registerCost(on: On) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, costUsd, () => usage.cost?.usd ?? null)

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('cost') && e.cost) {
      const total = e.cost.usd
      await update($, costUsd, () => total)
    }

    return next(e)
  })
}
