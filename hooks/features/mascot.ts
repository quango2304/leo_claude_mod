import { atom, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { Mood } from '../../types'
import { FRAME_TICKS, FRAMES } from '../mascot'

// What the dog at the desktop line's left is doing, from what the session is
// doing. The mood and the frame within it are two atoms the line reads; the
// facts behind them (a turn running, when the last key and the last answer
// were) stay here, and a timer lets the short moods run out and steps the
// animation.
const mascotMood = atom({ plugin: 'leo-mods', key: 'mascotMood' } as const, 'idle' as Mood)
const mascotFrame = atom({ plugin: 'leo-mods', key: 'mascotFrame' } as const, 0)

// The timer ticks often, to read the draft and the mood, so a stop in typing
// shows fast; each mood steps its picture every FRAME_TICKS of them.
const TICK_MS = 200
const TYPING_MS = 500
const DONE_MS = 3000
const HOLD_MS = 2000

type Facts = { isWorking: boolean; keyAt: number; doneAt: number }

// The mood the facts add up to. She listens while you type, even mid-turn;
// then works while a turn runs, cheers for a moment when it ends with an
// answer, else dozes.
export function moodAt(facts: Facts, now: number): Mood {
  if (now - facts.keyAt < TYPING_MS) {
    return 'typing'
  }

  if (facts.isWorking) {
    return 'working'
  }

  return now - facts.doneAt < DONE_MS ? 'done' : 'idle'
}

// Every mood change swaps the picture, so a mood stays at least HOLD_MS before
// another replaces it. Typing cuts in at once, and ends at once.
export function holdMood(current: Mood, next: Mood, shownAt: number, now: number): Mood {
  return next === 'typing' || current === 'typing' || now - shownAt >= HOLD_MS ? next : current
}

const NEVER = -Infinity
const facts: Facts = { isWorking: false, keyAt: NEVER, doneAt: NEVER }
let current: Mood = 'idle'
let shownAt = 0
let frame = 0
let ticks = 0
let timer: Timer | null = null

// The draft as of the last tick. The desktop reports an edit late (prompt.edit
// fires well after the keys), so each tick also reads the draft, and a change
// to it is typing. Only the timer reads it: from inside a hook (an edit, a tool
// check) the read can wait on that very hook.
let draft = ''

async function pollDraft($: EngineInterface) {
  const { text } = await $.prompt.read()

  if (text !== draft && text !== '') {
    facts.keyAt = await $.clock.now()
  }

  draft = text
}

// One timer tick: recomputes the mood, steps the animation, and writes either
// only when it changed, so the line (a plain image, swapped per frame) redraws
// only when the picture does.
async function settle($: EngineInterface) {
  const now = await $.clock.now()
  const next = holdMood(current, moodAt(facts, now), shownAt, now)

  if (next !== current) {
    current = next
    shownAt = now
    ticks = 0
    await update($, mascotMood, () => next)
  } else {
    ticks += 1
  }

  const nextFrame = Math.floor(ticks / FRAME_TICKS[next]) % FRAMES[next].length

  if (nextFrame !== frame) {
    frame = nextFrame
    await update($, mascotFrame, () => nextFrame)
  }
}

// Starts the timer the first time one of her own hooks runs.
function ensureTimer($: EngineInterface) {
  timer ??= $.clock.every(TICK_MS, () => {
    void pollDraft($).catch(() => undefined)
    void settle($)
  })
}

// The events another feature already hooks (the engine takes one hook per
// event per plugin, and `$` can't cross a file) record the fact here, plain,
// and the timer above turns it into a mood.
export function noteTurnStart() {
  facts.isWorking = true
}

// Only the main conversation's turns count: a subagent's end isn't hers.
export function noteTurnEnd(now: number, e: { agentId?: string; reason: string }) {
  if (e.agentId === undefined) {
    facts.isWorking = false

    if (e.reason === 'answer') {
      facts.doneAt = now
    }
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
      facts.keyAt = await $.clock.now()
      ensureTimer($)
    }

    return next(e)
  })

  // Every row the conversation keeps (a prompt, a reply, a tool result) is a
  // sign of life: it starts the timer.
  on('session.append', async ($, e, next) => {
    ensureTimer($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    facts.keyAt = NEVER
    ensureTimer($)

    return next(e)
  })
}
