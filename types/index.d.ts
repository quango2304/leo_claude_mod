export type Usd = number | null

declare module 'claude-code' {
  interface PluginState {
    'leo-mods': { costUsd: Usd }
  }
}
