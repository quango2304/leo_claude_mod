import { expect, test } from 'claude-code/testing'

import { resetTimeLabel, usageMeters } from '../hooks/features/usage'

// The weekly window shows when it resets, in local time; the 5-hour one
// keeps its countdown.
test('the weekly window shows its reset day and time', async () => {
  expect(resetTimeLabel(new Date(2026, 9, 3, 21, 0).getTime())).toBe('Sat 9:00 PM')
  expect(resetTimeLabel(new Date(2026, 9, 5, 0, 5).getTime())).toBe('Mon 12:05 AM')
  expect(resetTimeLabel(new Date(2026, 9, 5, 12, 30).getTime())).toBe('Mon 12:30 PM')

  const now = new Date(2026, 9, 2, 10, 0).getTime()
  const meters = usageMeters(null, [
    { kind: 'five_hour', percentUsed: 23, resetsAt: new Date(now + 80 * 60_000).toISOString() },
    { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(2026, 9, 3, 21, 0).toISOString() },
  ], now)

  expect(meters).toEqual([
    { name: '5h', percent: 23, detail: '1h20m' },
    { name: 'week', percent: 12, detail: 'Sat 9:00 PM' },
  ])
})
