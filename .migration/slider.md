# slider

2026-08-12 — golden pair via shadcn CLI (`shadcn add slider --overwrite`). Verdict: migrated.

## Changed
- `components/ui/slider.tsx`: `Slider as SliderPrimitive` from `radix-ui` -> `@base-ui/react/slider`. Restructured to base-ui anatomy: `Root > Control > Track > Indicator` + `Thumb` parts. `Range` -> `Indicator`; new `Control` wrapper holds the layout classes that previously lived on `Root`.
- Added `thumbAlignment="edge"` on Root (base-ui thumbs align to track edges).
- Layout classes (`relative flex w-full touch-none ... data-vertical:flex-col`) moved from Root to `Control`, per base-ui's structure. Root keeps only `data-horizontal:w-full data-vertical:h-full`.
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- `thumbAlignment="edge"` may shift thumb positioning by ~half a thumb width vs the old centered layout — verify visually. Otherwise `value` / `defaultValue` / `min` / `max` / `onValueChange` pass through.

## Verify by hand
- Drag a single-thumb slider; value updates.
- Multi-thumb range slider (array `defaultValue`): two thumbs render and don't cross.
- Vertical orientation (`orientation="vertical"`) lays out vertically.
- Keyboard arrows step the focused thumb.
