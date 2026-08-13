# badge

2026-08-12 — golden pair via shadcn CLI (`shadcn add badge --overwrite`). Verdict: migrated.

## Changed
- `components/ui/badge.tsx`: `Slot` from `radix-ui` + `asChild ? Slot.Root : "span"` idiom -> `useRender` + `mergeProps` from `@base-ui/react/use-render` / `@base-ui/react/merge-props` (correct pattern for non-button polymorphic components). Type `React.ComponentProps<"span"> & { asChild? } & VariantProps` -> `useRender.ComponentProps<"span"> & VariantProps`.
- `asChild` prop -> `render` prop. Classes updated to base-nova (`rounded-4xl`, `h-5`, `has-data-[icon=...]` padding hooks).
- Leftover scan clean.

## Left alone
- `badgeVariants` export kept.

## Behavior changes
- The `data-slot="badge"` attribute is no longer set on the rendered element (the new pattern uses `state.slot` for render-prop consumers, not a DOM attribute). No app code selected `[data-slot=badge]` in CSS, so no breakage — but verify if custom CSS relied on it.
- `asChild` removed; use `render={<a/>}` for link badges.

## Verify by hand
- Default/secondary/destructive/outline/ghost/link badges render with nova styling.
- Link badge (`<Badge render={<a href/>}>`) still inherits variants.
