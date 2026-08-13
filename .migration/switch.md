# switch

2026-08-12 — golden pair via shadcn CLI (`shadcn add switch --overwrite`). Verdict: migrated.

## Changed
- `components/ui/switch.tsx`: `Switch as SwitchPrimitive` from `radix-ui` -> `@base-ui/react/switch`. 1:1 mapping (`Root`, `Thumb`). Types -> `SwitchPrimitive.Root.Props` / `SwitchPrimitive.Thumb.Props`.
- Classes already used base-ui data attributes (`data-checked` / `data-unchecked`) pre-migration; base-nova variant keeps them. `transition-[background-color,border-color,box-shadow]` -> `transition-all`.
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- None. `checked` / `defaultChecked` / `onCheckedChange` pass through unchanged at the wrapper level.

## Verify by hand
- Toggle on/off: thumb translates, track color swaps to primary when checked.
- `size="sm"` renders the smaller track.
- Disabled switch is non-interactive and dimmed; keyboard Space toggles.
