import { expect, test } from 'claude-code/testing'

import { moodAt } from '../hooks/features/mascot'
import { FRAMES, svgMascot } from '../hooks/mascot'

const quiet = { isWorking: false, tools: 0, waits: 0, keyAt: -Infinity, doneAt: -Infinity, errorAt: -Infinity, activeAt: 0 }

// Waiting on you outranks everything, then a failure, then a running tool,
// then a thinking turn, then typing, then a finished turn; a long quiet spell
// puts her to sleep, and the short moods run out.
test('the mood follows what the session is doing', () => {
  expect(moodAt(quiet, 1000)).toBe('idle')
  expect(moodAt({ ...quiet, keyAt: 900 }, 1000)).toBe('typing')
  expect(moodAt({ ...quiet, keyAt: 900 }, 4000)).toBe('idle')
  expect(moodAt({ ...quiet, keyAt: 900, isWorking: true }, 1000)).toBe('thinking')
  expect(moodAt({ ...quiet, isWorking: true, tools: 1 }, 1000)).toBe('working')
  expect(moodAt({ ...quiet, isWorking: true, tools: 1, waits: 1 }, 1000)).toBe('waiting')
  expect(moodAt({ ...quiet, doneAt: 900 }, 1000)).toBe('done')
  expect(moodAt({ ...quiet, doneAt: 900 }, 4000)).toBe('idle')
  expect(moodAt({ ...quiet, isWorking: true, tools: 1, errorAt: 900 }, 1000)).toBe('error')
  expect(moodAt({ ...quiet, waits: 1, errorAt: 900 }, 1000)).toBe('waiting')
  expect(moodAt(quiet, 5 * 60_000)).toBe('sleeping')
})

test('every frame of every mood draws a transparent pixel svg', () => {
  for (const mood of Object.keys(FRAMES) as (keyof typeof FRAMES)[]) {
    FRAMES[mood].forEach((_, i) => {
      const svg = svgMascot(mood, i)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).not.toContain('undefined')
      expect(svg).not.toContain('NaN')
    })
  }
})
