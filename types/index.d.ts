export type Mood = 'idle' | 'typing' | 'working' | 'done'

export type Usd = number | null

export type Percent = number | null

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'leo-mods': {
      costUsd: Usd
      contextPercent: Percent
      limits: Limit[]
      runningAgents: number
      activeMs: number
      outputSpeed: number | null
      cacheAt: number | null
      cacheTtlMs: number | null
      cacheLeftMs: number | null
      nowMs: number
      mascotMood: Mood
      mascotFrame: number
    }
  }
}
