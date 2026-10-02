import { expect, test } from 'claude-code/testing'

import { moodAt } from '../hooks/features/mascot'
import { FRAMES, svgMascot } from '../hooks/mascot'

const quiet = { isWorking: false, keyAt: -Infinity, doneAt: -Infinity }

// Typing outranks everything (even mid-turn), then a running turn, then a
// finished one; else she dozes. The short moods run out.
test('the mood follows what the session is doing', () => {
  expect(moodAt(quiet, 1000)).toBe('idle')
  expect(moodAt({ ...quiet, keyAt: 900 }, 1000)).toBe('typing')
  expect(moodAt({ ...quiet, keyAt: 900 }, 1700)).toBe('idle')
  expect(moodAt({ ...quiet, keyAt: 900, isWorking: true }, 1000)).toBe('typing')
  expect(moodAt({ ...quiet, isWorking: true }, 1000)).toBe('working')
  expect(moodAt({ ...quiet, doneAt: 900 }, 1000)).toBe('done')
  expect(moodAt({ ...quiet, doneAt: 900 }, 4000)).toBe('idle')
  expect(moodAt({ ...quiet, isWorking: true, doneAt: 900 }, 1000)).toBe('working')
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
