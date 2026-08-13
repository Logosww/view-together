# tabs

2026-08-12 — golden pair via shadcn CLI (`shadcn add tabs --overwrite`). Verdict: migrated.

## Changed
- `components/ui/tabs.tsx`: `Tabs as TabsPrimitive` from `radix-ui` -> `@base-ui/react/tabs`. Part renames: `Trigger` -> `Tab` (`TabsPrimitive.Tab`), `Content` -> `Panel` (`TabsPrimitive.Panel`). Types -> `TabsPrimitive.Root.Props` / `.List.Props` / `.Tab.Props` / `.Panel.Props`.
- `TabsTrigger` gains `aria-disabled:pointer-events-none aria-disabled:opacity-50` alongside `disabled:*` (base-ui uses `aria-disabled`).
- `tabsListVariants` and the `variant` (`default` / `line`) customization preserved. `data-variant` attribute on `TabsList` kept (internal, used by trigger selectors).
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- base-ui Tabs use automatic activation by default (focus activates) — same as radix default. No `activationMode` was set by consumers, so no change.
- Disabled tabs now also set `aria-disabled` (in addition to `disabled`); visually equivalent.

## Verify by hand
- "选择视频源" dialog Tabs (url / file): switching tabs shows the right panel; active tab gets the background/line style per `variant`.
- Keyboard Left/Right moves between tabs.
- `variant="line"` shows the underline indicator on the active tab.
