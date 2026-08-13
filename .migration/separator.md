# separator

2026-08-12 — golden pair via shadcn CLI (`shadcn add separator --overwrite`). Verdict: migrated.

## Changed
- `components/ui/separator.tsx`: `Separator as SeparatorPrimitive` from `radix-ui` -> `@base-ui/react/separator`. Single-part primitive is now callable: `SeparatorPrimitive.Root` -> `SeparatorPrimitive`. Type `React.ComponentProps<typeof SeparatorPrimitive.Root>` -> `SeparatorPrimitive.Props`.
- `decorative` prop dropped (base-ui has no such prop; the `decorative` destructure was removed).
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- `decorative` prop no longer accepted (was purely an a11y hint in radix; base-ui separator is always aria-semantic). No app code passed `decorative`.

## Verify by hand
- Horizontal/vertical separators render with correct 1px sizing.
