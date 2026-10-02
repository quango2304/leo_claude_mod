import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

import type { Usd } from '../types'
import { costLabel, registerCost } from './features/cost'

// The footer reads each feature's value through its own atom on the same
// state key: the engine only follows $ and state reads within one file.
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)

// To add a feature: write hooks/features/<name>.ts exporting register<Name>(on)
// and, if it shows something, a <name>Label(value) formatter; declare its atom
// here and add its label to the list below.
export const register: Register = on => {
  registerCost(on)

  // The terminal draws a mod's footer labels; the desktop app asks for them
  // but doesn't draw them, so there the labels go on a line above the prompt.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const labels = [costLabel(await read($, costUsd))].filter(l => l !== null)

    if (e.surface !== 'terminal' || labels.length === 0) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, ...labels] } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const labels = [costLabel(await read($, costUsd))].filter(l => l !== null)

    if (e.surface !== 'desktop' || e.props.hasSurvey || labels.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box justifyContent="flex-end">
        <Text dimColor>{labels.join('  ·  ')}</Text>
      </Box>
    )
  })
}
