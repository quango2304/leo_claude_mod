import { expect, test } from 'claude-code/testing'

import { meterSize, PLACEHOLDER_METERS } from '../hooks/meters'

// Before any reading the desktop band keeps its shape: the same meters at the
// same size as live ones, with empty bars, zeroed numbers and a $0.00 cost.
test('a fresh session shows placeholders on the desktop', async $ => {
  const ui = await $.ui.mount({
    plugin: 'leo-mods',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  })

  const bars = await ui.findAll({ type: 'Svg' })
  expect(bars.map(b => b.props.alt)).toEqual(['$0.00 · -- tok/s · active 0m', 'cache 00m', 'context 00%', '5h 00% 0h00m', 'week 00% --- -:-- --'])
  expect(bars.slice(1).map(b => [b.props.width, b.props.height])).toEqual(PLACEHOLDER_METERS.map(m => [meterSize(m).width, meterSize(m).height]))
  expect(bars[0]?.props.height).toBe(meterSize(PLACEHOLDER_METERS[0]!).height)
})
