import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

import type { Usd } from '../types'
import { costLabel, registerCost } from './features/cost'

// The footer reads each feature's value through its own atom on the same
// state key: the engine only follows $ and state reads within one file.
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)

// To add a feature: write hooks/features/<name>.ts exporting register<Name>(on)
// and, if it shows something in the footer, a <name>Label(value) formatter;
// declare its atom here and add its label below.
export const register: Register = on => {
  registerCost(on)

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const labels = [costLabel(await read($, costUsd))].filter(l => l !== null)

    if (labels.length === 0) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, ...labels] } })
  })
}
