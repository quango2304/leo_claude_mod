import { expect, mock, test } from 'claude-code/testing'

const DESKTOP = {
  plugin: 'leo-mods',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const usage = (output_tokens: number) => ({
  input_tokens: 10,
  output_tokens,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

// The speed is the turn's output tokens over its streaming time, from each
// response's first piece to its last; a turn's requests add up.
test('output speed counts streaming time across a turn', { timeoutMs: 20_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  let finish = () => {}

  on('turn.step', async function* (_$, e) {
    const tokens = e.index === 0 ? 50 : 350
    yield { kind: 'text', index: 0, text: 'Hi' } as const
    await new Promise<void>(resolve => (finish = resolve))
    yield { kind: 'stop', stopReason: 'end_turn', usage: usage(tokens) } as const

    return { turnId: e.turnId, index: e.index, answer: 'Hi', toolUses: [], stopReason: 'end_turn', usage: usage(tokens) }
  })

  // One response: its first piece now, its last `ms` later.
  async function respond(index: number, ms: number) {
    const stream = $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', messageCount: 1 })
    const reading = (async () => {
      for await (const _ of stream) {
        // read to the end
      }
    })()

    await clock.advance(ms)
    finish()
    await reading
  }

  async function speedShown() {
    const ui = await $.ui.mount(DESKTOP)

    return (await ui.findAll({ type: 'Svg' }))[1]?.props.alt
  }

  // 50 tokens over 1 s.
  await respond(0, 1_000)
  expect(await speedShown()).toBe('$0.00 · 50 tok/s · active 0m')

  // The turn so far: 400 tokens over 4 s.
  await respond(1, 3_000)
  expect(await speedShown()).toBe('$0.00 · 100 tok/s · active 0m')
})
