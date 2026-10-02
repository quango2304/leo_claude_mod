# leo_claude_mod

Leo's personal mods for Claude Code (terminal and the desktop app's Code tab), packaged as one plugin with the ID `leo-mods`.

## Features

| Feature | File | What it does |
| --- | --- | --- |
| Session cost | `hooks/features/cost.ts` | Shows the session's total cost (USD), e.g. `$1.09`: as a footer label in the terminal, and as one right-aligned line above the prompt in the desktop app (see below for why). It is read at session start and updated after each turn. |

The cost is the same estimate `/cost` shows, priced at API list rates. On a Pro/Max subscription it is not what you pay.

## Install

From a terminal:

```bash
claude plugin marketplace add quango2304/leo_claude_mod
```

```bash
claude plugin install leo-mods@quango2304
```

Or inside an interactive `claude` session: `/plugin marketplace add quango2304/leo_claude_mod`, then `/plugin install leo-mods@quango2304`.

Start a new session (in the terminal or the desktop app's Code tab). The cost appears after the first turn: in the footer in the terminal, above the prompt in the desktop app.

**Update** to the latest version:

```bash
claude plugin marketplace update quango2304
```

```bash
claude plugin update leo-mods@quango2304
```

**Uninstall:**

```bash
claude plugin uninstall leo-mods@quango2304
```

## Develop

Clone the repo and load it straight from disk instead of the installed copy, by adding it to the `env` block of `~/.claude/settings.json`:

```json
"env": {
  "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/leo_claude_mod",
  "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
}
```

`CLAUDE_CODE_PLUGIN_DIR_WATCH` makes edits reload in a running session; without it, changes apply from the next new session. Don't have the installed plugin enabled at the same time, or both copies load and the footer shows the cost twice (`claude plugin disable leo-mods@quango2304`).

To publish a change, bump `version` in `.claude-plugin/plugin.json` so `claude plugin update` picks it up.

## Layout

```
leo_claude_mod/
├── .claude-plugin/
│   ├── plugin.json              manifest (plugin ID "leo-mods")
│   └── marketplace.json         makes this repo installable as marketplace "quango2304"
├── hooks/
│   ├── hooks.json               points to register.tsx
│   ├── register.tsx             wires up the features and draws their labels
│   └── features/
│       └── cost.ts              feature: session cost
├── types/index.d.ts             declares every value the plugin stores ($.state)
├── docs/ui-spots.png            where a mod can draw (see below)
└── tsconfig.json                editor typings (the engine writes them to .claude-plugin/types)
```

## Where a mod can draw

![Where a mod can draw in the desktop Code tab](docs/ui-spots.png)

Solid boxes are things already on screen; dashed boxes are spots that stay empty until a mod uses them.

| # | Spot | Render component / call | Size | Good for |
| --- | --- | --- | --- | --- |
| 1 | **Transcript rows**: messages, tool calls, tool results | `UserMessage`, `AssistantMessage`, `ToolUse`, `ToolResult`, `ToolGroup`, `CommandOutput` | inline | restyling or annotating messages |
| 2 | **Toast**: a popup at the top right of the transcript | `$.ui.toast(text)` | small; disappears after 4s by default | one-off alerts, e.g. "cost passed $5" |
| 3 | **Line above the prompt** | `AbovePrompt` | a full-width box | buttons, inputs, several lines |
| 4 | **Footer labels**, next to the model and effort | `SessionMode` (add to `e.props.modes`) | a few characters | short live values, **terminal only**: the desktop app asks for them but doesn't draw them |
| 5 | **Spinner**: the turn indicator | `Spinner` | one row, only while a turn runs | live per-turn info |
| – | **Pane**: a panel the mod opens (not in the screenshot) | `$.ui.open({ id, title })` + `Pane` | docked panel, or a box above the prompt | dashboards, lists, breakdowns |

Positions 2 and 5 are approximate: they come from the API docs, not from watching a mod draw there. Spot 4 was tested: the terminal draws a mod's footer labels, but the desktop app (as of Claude Code 2.1.286) asks for them once and never draws them. That is why this plugin puts its labels in the footer in the terminal and on a line above the prompt (3) in the desktop app.

Terminal-only spots, which the desktop app doesn't draw: the hint line under the prompt (`PromptHint`'s `tail`), `TurnDuration`, `InfoNotice`, `ToolProgress`. The pinned status line (`$.ui.status`) is not confirmed on desktop.

A rough rule: short numbers go in the footer (4) in the terminal and above the prompt (3) on desktop, details in a Pane opened by a slash command, and alerts as toasts (2).

## Adding a feature

The engine scans the module before loading it and enforces three rules:

- `on` may be passed to a named function in another file, so a feature exports `register<Name>(on: On)` and puts its hooks there.
- `$` is never passed across an import. A hook defined in a feature file can use `$` itself, but UI that combines several features (the labels) is drawn in `register.tsx`.
- Every state read/write names its `atom({ plugin: 'leo-mods', key })` in the same file, so a value the UI reads is declared once in the feature file (to write it) and again in `register.tsx` (to read it), with the same key.

Steps:

1. Write `hooks/features/<name>.ts` exporting `register<Name>(on)` and, if it shows something, a plain `<name>Label(value)` formatter. Use `cost.ts` as the template.
2. Declare any stored value in `types/index.d.ts` under `'leo-mods'`.
3. In `register.tsx`, call `register<Name>(on)`, declare the atom with the same key, and add its label to both `labels` lists (footer and desktop line).
4. Validate:

```bash
claude plugin validate ~/Desktop/leo_claude_mod
```

The full API reference is in the `plugin-authoring` skill; ask Claude to load it when writing a new feature.
