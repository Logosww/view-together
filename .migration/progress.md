# progress

2026-08-12 — golden pair via shadcn CLI (`shadcn add progress --overwrite`). Verdict: migrated.

## Changed
- `components/ui/progress.tsx`: `Progress as ProgressPrimitive` from `radix-ui` -> `@base-ui/react/progress`. Restructured to base-ui anatomy: `Root > Track > Indicator`, plus new `Label` / `Value` parts.
- The manual fill transform (`style={{ transform: translateX(-${100 - value}%) }}`) was removed — base-ui's primitive computes the indicator fill from `value`.
- Exports expanded: now exports `Progress`, `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue` (previously only `Progress`). `Progress` renders Track+Indicator internally, so `<Progress value={x}/>` still works unchanged.
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- Fill is now driven by the primitive (Indicator width) instead of a manual `translateX`. Visually equivalent (full-width indicator translating from left), but the transition is `transition-all` on width rather than transform.

## Verify by hand
- `<Progress value={50}/>` shows a half-filled track.
- Value 0 / 100 render empty / full.
