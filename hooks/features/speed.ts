import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

// How fast the model writes: the main conversation's output tokens per
// second, over the current turn's model requests. Each request is timed from
// its first streamed piece to its last, so the wait before the model starts
// answering doesn't count. Summed over the turn, since one request that only
// calls a tool is a few dozen tokens and would make the number jump.
const outputSpeed = atom({ plugin: 'leo-mods', key: 'outputSpeed' } as const, null as number | null)

// Under this much streaming the timing is too coarse to divide by.
const MIN_MS = 250

let turn = { id: '', tokens: 0, ms: 0 }

// "62 tok/s"; "-- tok/s" before the first measurement, so the line keeps its
// shape.
export function speedLabel(tokensPerSecond: number | null) {
  return tokensPerSecond === null ? '-- tok/s' : `${Math.round(tokensPerSecond)} tok/s`
}

export function registerSpeed(on: On) {
  on('turn.step', async function* ($, e, next) {
    // Subagents run their own requests; the line is the main conversation's.
    if (e.agentId !== undefined) {
      return yield* next(e)
    }

    const stream = next(e)
    let firstAt: number | null = null

    for await (const chunk of stream) {
      if (firstAt === null && chunk.kind !== 'engine') {
        firstAt = await $.clock.now()
      }

      if (chunk.kind === 'stop' && chunk.usage !== null && firstAt !== null) {
        const ms = (await $.clock.now()) - firstAt

        if (turn.id !== e.turnId) {
          turn = { id: e.turnId, tokens: 0, ms: 0 }
        }

        turn.tokens += chunk.usage.output_tokens
        turn.ms += ms

        if (turn.ms >= MIN_MS) {
          const speed = (turn.tokens * 1000) / turn.ms
          await update($, outputSpeed, () => speed)
        }
      }

      yield chunk
    }

    return await stream.result
  })
}
