import { atom, read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Percent, Usd } from '../types'
import { activeLabel, agentsLabel, registerActivity } from './features/activity'
import { cacheMeter, costColor, costLabel, registerUsage, usageMeters } from './features/usage'
import { meterSize, meterText, svgMeter, textMeter } from './meters'

// The line reads each feature's value through its own atom on the same
// state key: the engine only follows $ and state reads within one file.
const contextPercent = atom({ plugin: 'leo-mods', key: 'contextPercent' } as const, null as Percent)
const limits = atom({ plugin: 'leo-mods', key: 'limits' } as const, [] as Limit[])
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)
const runningAgents = atom({ plugin: 'leo-mods', key: 'runningAgents' } as const, 0)
const activeMs = atom({ plugin: 'leo-mods', key: 'activeMs' } as const, 0)
const cacheLeftMs = atom({ plugin: 'leo-mods', key: 'cacheLeftMs' } as const, null as number | null)
const cacheTtlMs = atom({ plugin: 'leo-mods', key: 'cacheTtlMs' } as const, null as number | null)

// What the line shows: activity (active time, agents) on the left; meters
// (cache, ctx, 5h, 7d) and plain labels (cost) on the right.
async function readLine($: EngineInterface) {
  const activity = [activeLabel(await read($, activeMs)), agentsLabel(await read($, runningAgents))].filter(
    l => l !== null,
  )
  const cache = cacheMeter(await read($, cacheLeftMs), await read($, cacheTtlMs))
  const meters = [...(cache === null ? [] : [cache]), ...usageMeters(await read($, contextPercent), await read($, limits))]
  const cost = await read($, costUsd)
  const labels = cost === null ? [] : [{ text: costLabel(cost), color: costColor(cost) }]

  return { activity, meters, labels, isEmpty: activity.length === 0 && meters.length === 0 && labels.length === 0 }
}

// To add a feature: write hooks/features/<name>.ts exporting register<Name>(on)
// and a formatter; declare its atom here and add its meter or label in readLine.
export const register: Register = on => {
  registerUsage(on)
  registerActivity(on)

  // The terminal draws a mod's footer labels, so there the line is one label:
  // "active 12m · 2 agents · ctx ▰▰▱▱▱ 42% · 5h ▰▱▱▱▱ 23% · $0.13".
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'terminal' || line.isEmpty) {
      return next(e)
    }

    const text = [
      ...line.activity,
      ...line.meters.map(m => `${m.name} ${textMeter(m.percent)} ${meterText(m)}`),
      ...line.labels.map(l => l.text),
    ].join(' · ')

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, text] } })
  })

  // The desktop app asks for footer labels but doesn't draw them, so there
  // the line goes above the prompt: activity at the left, the rest at the
  // right with SVG bars.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'desktop' || e.props.hasSurvey || line.isEmpty) {
      return next(e)
    }

    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box justifyContent="space-between" alignItems="center">
        {line.activity.length === 0 ? <Box /> : <Text dimColor>{line.activity.join(' · ')}</Text>}
        <Box alignItems="center" gap={3}>
          {line.meters.map(m => (
            <Box key={m.name} alignItems="center" gap={1}>
              <Text dimColor>{m.name}</Text>
              <Svg
                source={svgMeter(m)}
                alt={`${m.name} ${meterText(m)}`}
                width={meterSize.width}
                height={meterSize.height}
              />
              <Text dimColor>{meterText(m)}</Text>
            </Box>
          ))}
          {line.labels.map(l => (
            <Text key={l.text} color={l.color}>
              {l.text}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
