import { atom, read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Percent, Usd } from '../types'
import { activeLabel, agentsLabel, registerActivity } from './features/activity'
import { cacheMeter, costColor, costLabel, registerUsage, usageMeters } from './features/usage'
import { type Meter, meterAlt, meterSize, meterText, PLACEHOLDER_METERS, type Summary, summarySize, summaryText, svgMeter, svgSummary, textMeter } from './meters'

// The line reads each feature's value through its own atom on the same
// state key: the engine only follows $ and state reads within one file.
const contextPercent = atom({ plugin: 'leo-mods', key: 'contextPercent' } as const, null as Percent)
const limits = atom({ plugin: 'leo-mods', key: 'limits' } as const, [] as Limit[])
const costUsd = atom({ plugin: 'leo-mods', key: 'costUsd' } as const, null as Usd)
const runningAgents = atom({ plugin: 'leo-mods', key: 'runningAgents' } as const, 0)
const activeMs = atom({ plugin: 'leo-mods', key: 'activeMs' } as const, 0)
const cacheLeftMs = atom({ plugin: 'leo-mods', key: 'cacheLeftMs' } as const, null as number | null)
const cacheTtlMs = atom({ plugin: 'leo-mods', key: 'cacheTtlMs' } as const, null as number | null)
const nowMs = atom({ plugin: 'leo-mods', key: 'nowMs' } as const, 0)

// What the line shows: the summary (cost, active time, agents) and the meters
// (cache, context, 5h, week).
async function readLine($: EngineInterface): Promise<{ summary: Summary; meters: Meter[] }> {
  const active = await read($, activeMs)
  const cache = cacheMeter(await read($, cacheLeftMs), await read($, cacheTtlMs))
  const meters = [...(cache === null ? [] : [cache]), ...usageMeters(await read($, contextPercent), await read($, limits), await read($, nowMs))]
  const cost = await read($, costUsd)
  const summary = {
    cost: cost === null ? '' : costLabel(cost),
    costColor: costColor(cost ?? 0),
    active: activeLabel(active),
    agents: agentsLabel(await read($, runningAgents)),
  }

  // Before the first response there's no context reading and the cost is $0
  // (never absent in the CLI).
  if ((await read($, contextPercent)) === null && (cost ?? 0) === 0 && active === 0) {
    return { summary: { ...summary, cost: costLabel(0) }, meters: PLACEHOLDER_METERS }
  }

  return { summary, meters }
}

// To add a feature: write hooks/features/<name>.ts exporting register<Name>(on)
// and a formatter; declare its atom here and add its meter or label in readLine.
export const register: Register = on => {
  registerUsage(on)
  registerActivity(on)

  // The terminal draws a mod's footer labels, so there the line is one label:
  // "active 12m · 2 agents · context ▰▰▱▱▱ 42% · 5h ▰▱▱▱▱ 23% · $0.13".
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'terminal') {
      return next(e)
    }

    const { summary } = line
    const text = [
      summary.active,
      summary.agents,
      ...line.meters.map(m => [m.name, textMeter(m.percent), meterText(m), m.detail].filter(Boolean).join(' ')),
      summary.cost,
    ].filter(Boolean).join(' · ')

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, text] } })
  })

  // The desktop app asks for footer labels but doesn't draw them, so there
  // the line goes above the prompt, all SVG (see meters.ts): the cost over the
  // active time and agents at the left, the meters at the right.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const line = await readLine($)

    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Svg } = $.ui.resolve(e)
    const { summary } = line
    const size = summarySize(summary)

    return (
      <Box justifyContent="space-between" alignItems="center" gap={3}>
        <Svg source={svgSummary(summary)} alt={summaryText(summary)} width={size.width} height={size.height} />
        <Box alignItems="center" gap={2} flexShrink={0}>
          {line.meters.map(m => (
            <Svg key={m.name} source={svgMeter(m)} alt={meterAlt(m)} width={meterSize.width} height={meterSize.height} />
          ))}
        </Box>
      </Box>
    )
  })
}
