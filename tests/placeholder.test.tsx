import { expect, test } from 'claude-code/testing'

// Before any reading the desktop band keeps its shape: empty bars, zeroed
// numbers and a $0.00 cost.
test('a fresh session shows placeholders on the desktop', async $ => {
  const ui = await $.ui.mount({
    plugin: 'leo-mods',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  })

  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(4)
  expect(await ui.findAll({ type: 'Text', text: '00%' })).toHaveLength(3)
  expect(await ui.find({ type: 'Text', text: '00m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'active 0m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '$0.00' })).toBeDefined()
})
