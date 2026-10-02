import { atom, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { Mood } from '../../types'
import { FRAMES } from '../mascot'

// What the dog at the desktop line's left is doing, from what the session is
// doing. The mood and the frame within it are two atoms the line reads; the
// facts behind them (a tool running, a question open, when the last key, the
// last answer and the last failure were) stay here, and a timer lets the short
// moods run out, steps the animation and puts her to sleep after a quiet spell.
const mascotMood = atom({ plugin: 'leo-mods', key: 'mascotMood' } as const, 'idle' as Mood)
const mascotFrame = atom({ plugin: 'leo-mods', key: 'mascotFrame' } as const, 0)

const TICK_MS = 500
const TYPING_MS = 3000
const DONE_MS = 3000
const ERROR_MS = 4000
const SLEEP_MS = 5 * 60_000

type Facts = { isWorking: boolean; tools: number; waits: number; keyAt: number; doneAt: number; errorAt: number; activeAt: number }

// The mood the facts add up to. She waits for you first (a question or a
// permission is open), then a failure; then works (a tool is running) or
// thinks (a turn runs with no tool); then typing, a finished turn, a long
// quiet spell, else idle.
export function moodAt(facts: Facts, now: number): Mood {
  if (facts.waits > 0) {
    return 'waiting'
  }

  if (now - facts.errorAt < ERROR_MS) {
    return 'error'
  }

  if (facts.tools > 0) {
    return 'working'
  }

  if (facts.isWorking) {
    return 'thinking'
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
const facts: Facts = { isWorking: false, tools: 0, waits: 0, keyAt: NEVER, doneAt: NEVER, errorAt: NEVER, activeAt: 0 }
// Tool calls whose permission is being asked, by id, so a wait ends with its call.
const asked = new Set<string>()
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

// Only the main conversation's turns count: a subagent's end isn't hers. A turn
// that ends (or is interrupted) closes whatever tool or question was open.
export function noteTurnEnd(now: number, e: { agentId?: string; reason: string }) {
  if (e.agentId === undefined) {
    Object.assign(facts, { isWorking: false, tools: 0, waits: 0, activeAt: now }, e.reason === 'error' ? { errorAt: now } : e.reason === 'answer' ? { doneAt: now } : {})
    asked.clear()
  }
}

export function registerMascot(on: On) {
  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = null

    return next(e)
  })

  // Typing is an edit that puts text in or takes some out; moving the cursor
  // isn't.
  on('prompt.edit', async ($, e, next) => {
    if (e.inputText !== '' || e.end > e.start) {
      await touch($, { keyAt: await $.clock.now() })
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await touch($, { keyAt: NEVER })

    return next(e)
  })

  // Every row the conversation keeps (a prompt, a reply, a tool result) is a
  // sign of life: it starts the timer, and wakes her.
  on('session.append', async ($, e, next) => {
    facts.activeAt = await $.clock.now()
    ensureTimer($)

    return next(e)
  })

  // A permission being asked for a real call: she waits until that call ends.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)

    if (e.tool_use_id !== undefined && verdict.decision === 'ask' && !asked.has(e.tool_use_id)) {
      asked.add(e.tool_use_id)
      await touch($, { waits: facts.waits + 1 })
    }

    return verdict
  })

  // A tool call: working while it runs (waiting, if it is the question tool
  // itself or its permission is open), and a failure is an error.
  on('tool.call', async ($, e, next) => {
    const isQuestion = e.tool === 'AskUserQuestion'
    await touch($, { tools: facts.tools + 1, ...(isQuestion ? { waits: facts.waits + 1 } : {}) })

    try {
      const ran = await next(e)

      if (ran.deny === undefined && ran.isError === true) {
        facts.errorAt = await $.clock.now()
      }

      return ran
    } finally {
      const wasAsked = asked.delete(e.tool_use_id)
      const waits = facts.waits - (isQuestion ? 1 : 0) - (wasAsked ? 1 : 0)
      await touch($, { tools: Math.max(0, facts.tools - 1), waits: Math.max(0, waits) })
    }
  })
}
