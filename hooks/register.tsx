import { atom, read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Percent, Usd } from '../types'
import { agentsLabel, registerAgents } from './features/agents'
import { costLabel, registerUsage, usageMeters } from './features/usage'
import { meterSize, svgMeter, textMeter } from './meters'

// The line reads each feature's value through its own atom on the same
// state key: the engine only follows $ and state reads within one file.
const contextPercent = atom({ plugin: 'leo-mods', key: 'contextPercent' } as const, null as Percent)
const limits = atom({ plugin: 'leo-mods', key: 'limits' } as const, [] as Limit[])
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)
const runningAgents = atom({ plugin: 'leo-mods', key: 'runningAgents' } as const, 0)

// What the line shows: agents on the left; meters (ctx, 5h, 7d) and plain
// labels (cost) on the right.
async function readLine($: EngineInterface) {
  const agents = agentsLabel(await read($, runningAgents))
  const meters = usageMeters(await read($, contextPercent), await read($, limits))
  const labels = [costLabel(await read($, costUsd))].filter(l => l !== null)

  return { agents, meters, labels, isEmpty: agents === null && meters.length === 0 && labels.length === 0 }
}

// To add a feature: write hooks/features/<name>.ts exporting register<Name>(on)
// and a formatter; declare its atom here and add its meter or label in readLine.
export const register: Register = on => {
  registerUsage(on)
  registerAgents(on)

  // The terminal draws a mod's footer labels, so there the line is one label:
  // "2 agents · ctx ▰▰▱▱▱ 42% · 5h ▰▱▱▱▱ 23% · $0.13".
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'terminal' || line.isEmpty) {
      return next(e)
    }

    const text = [
      ...(line.agents === null ? [] : [line.agents]),
      ...line.meters.map(m => `${m.name} ${textMeter(m.percent)} ${Math.round(m.percent)}%`),
      ...line.labels,
    ].join(' · ')

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, text] } })
  })

  // The desktop app asks for footer labels but doesn't draw them, so there
  // the line goes above the prompt: agents at the left, the rest at the
  // right with SVG bars.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'desktop' || e.props.hasSurvey || line.isEmpty) {
      return next(e)
    }

    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box justifyContent="space-between" alignItems="center">
        {line.agents === null ? <Box /> : <Text dimColor>{line.agents}</Text>}
        <Box alignItems="center" gap={3}>
          {line.meters.map(m => (
            <Box key={m.name} alignItems="center" gap={1}>
              <Text dimColor>{m.name}</Text>
              <Svg
                source={svgMeter(m.percent)}
                alt={`${m.name} ${Math.round(m.percent)}%`}
                width={meterSize.width}
                height={meterSize.height}
              />
              <Text dimColor>{Math.round(m.percent)}%</Text>
            </Box>
          ))}
          {line.labels.map(l => (
            <Text key={l} dimColor>
              {l}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
