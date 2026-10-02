import { atom, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

// How many subagents are running right now, from $.agent.list(). Refreshed
// when one starts and when any turn ends, and polled while any are running,
// since a subagent can finish between turns.
const runningAgents = atom({ plugin: 'leo-mods', key: 'runningAgents' } as const, 0)

const POLL_MS = 2000

let poller: Timer | null = null

// "2 agents", or null when none are running.
export function agentsLabel(running: number) {
  if (running === 0) {
    return null
  }

  return running === 1 ? '1 agent' : `${running} agents`
}

async function refresh($: EngineInterface) {
  const agents = await $.agent.list()
  const running = agents.filter(a => a.status === 'running').length
  await update($, runningAgents, () => running)

  if (running > 0 && poller === null) {
    poller = $.clock.every(POLL_MS, () => void refresh($))
  } else if (running === 0 && poller !== null) {
    poller.cancel()
    poller = null
  }
}

export function registerAgents(on: On) {
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })
}
