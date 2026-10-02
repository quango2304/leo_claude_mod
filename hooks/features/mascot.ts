import { atom, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { Mood } from '../../types'
import { FRAMES } from '../mascot'

// What the dog at the desktop line's left is doing, from what the session is
// doing. The mood is one atom the line reads; the facts behind it (when the
// last key, the last answer and the last failure were) stay here, and a
// one-second timer lets the short moods (typing, done, error) run out and
// puts her to sleep after a quiet spell.
const mascotMood = atom({ plugin: 'leo-mods', key: 'mascotMood' } as const, 'idle' as Mood)
const mascotFrame = atom({ plugin: 'leo-mods', key: 'mascotFrame' } as const, 0)

const TICK_MS = 600
const TYPING_MS = 3000
const DONE_MS = 3000
const ERROR_MS = 4000
const SLEEP_MS = 5 * 60_000

type Facts = { isWorking: boolean; keyAt: number; doneAt: number; errorAt: number; activeAt: number }

// The mood the facts add up to: a failure first, then work, typing, a
// finished turn, a long quiet spell, else idle.
export function moodAt(facts: Facts, now: number): Mood {
  if (now - facts.errorAt < ERROR_MS) {
    return 'error'
  }

  if (facts.isWorking) {
    return 'working'
  }

  if (now - facts.keyAt < TYPING_MS) {
    return 'typing'
  }

  if (now - facts.doneAt < DONE_MS) {
    return 'done'
  }

  return now - facts.activeAt >= SLEEP_MS ? 'sleeping' : 'idle'
}

const NEVER = -Infinity
const facts: Facts = { isWorking: false, keyAt: NEVER, doneAt: NEVER, errorAt: NEVER, activeAt: 0 }
let current: Mood = 'idle'
let frame = 0
let ticks = 0
let timer: Timer | null = null

// One timer tick: recomputes the mood, steps the animation, and writes either
// only when it changed, so the line (a plain image, swapped per frame) redraws
// only when the picture does.
async function settle($: EngineInterface) {
  const next = moodAt(facts, await $.clock.now())

  if (next !== current) {
    current = next
    ticks = 0
    await update($, mascotMood, () => next)
  } else {
    ticks += 1
  }

  const nextFrame = ticks % FRAMES[next].length

  if (nextFrame !== frame) {
    frame = nextFrame
    await update($, mascotFrame, () => nextFrame)
  }
}

// Starts the timer the first time one of her own hooks runs.
function ensureTimer($: EngineInterface) {
  timer ??= $.clock.every(TICK_MS, () => void settle($))
}

async function touch($: EngineInterface, change: Partial<Facts>) {
  const now = await $.clock.now()
  Object.assign(facts, { activeAt: now }, change)
  ensureTimer($)
  await settle($)
}

// The events another feature already hooks (the engine takes one hook per
// event per plugin, and `$` can't cross a file) record the fact here, plain,
// and the timer above turns it into a mood.
export function noteTurnStart(now: number) {
  Object.assign(facts, { isWorking: true, activeAt: now })
}

// Only the main conversation's turns count: a subagent's end isn't hers.
export function noteTurnEnd(now: number, e: { agentId?: string; reason: string }) {
  if (e.agentId === undefined) {
    Object.assign(facts, { isWorking: false, activeAt: now }, e.reason === 'error' ? { errorAt: now } : e.reason === 'answer' ? { doneAt: now } : {})
  }
}

export function registerMascot(on: On) {
  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = null

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const now = await $.clock.now()
    await touch($, { keyAt: now })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await touch($, { keyAt: NEVER })

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError === true) {
      await touch($, { errorAt: await $.clock.now() })
    }

    return ran
  })
}
