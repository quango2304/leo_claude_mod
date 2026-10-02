import { atom, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

// What the session is doing: active time (the main loop's turn durations,
// summed) and how many subagents are running. One feature, because both
// need turn.complete and the engine takes one hook per event per plugin.
const activeMs = atom({ plugin: 'leo-mods', key: 'activeMs' } as const, 0)
const runningAgents = atom({ plugin: 'leo-mods', key: 'runningAgents' } as const, 0)

const POLL_MS = 2000

let poller: Timer | null = null

// "active 0m", "active 12m", "active 1h 05m".
export function activeLabel(ms: number) {
  const minutes = Math.floor(ms / 60_000)

  return minutes < 60 ? `active ${minutes}m` : `active ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

// "2 agents", or null when none are running.
export function agentsLabel(running: number) {
  if (running === 0) {
    return null
  }

  return running === 1 ? '1 agent' : `${running} agents`
}

// Counts running subagents, and polls while any are, since a subagent can
// finish between turns.
async function refreshAgents($: EngineInterface) {
  const agents = await $.agent.list()
  const running = agents.filter(a => a.status === 'running').length
  await update($, runningAgents, () => running)

  if (running > 0 && poller === null) {
    poller = $.clock.every(POLL_MS, () => void refreshAgents($))
  } else if (running === 0 && poller !== null) {
    poller.cancel()
    poller = null
  }
}

export function registerActivity(on: On) {
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refreshAgents($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      const ms = e.durationMs
      await update($, activeMs, total => total + ms)
    }

    await refreshAgents($)

    return result
  })
}
