export type Usd = number | null

export type Percent = number | null

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'leo-mods': {
      costUsd: Usd
      contextPercent: Percent
      limits: Limit[]
      limitAlerted: string[]
      runningAgents: number
      activeMs: number
      cacheAt: number | null
      cacheTtlMs: number | null
      cacheLeftMs: number | null
      cacheColdToasted: number | null
      nowMs: number
    }
  }
}
