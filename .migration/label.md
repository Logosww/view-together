# label

2026-08-12 — golden pair via shadcn CLI (`shadcn add label --overwrite`). Verdict: migrated.

## Changed
- `components/ui/label.tsx`: `Label as LabelPrimitive` from `radix-ui` -> native `<label>` element (base-ui ships no Label primitive). Type `React.ComponentProps<typeof LabelPrimitive.Root>` -> `React.ComponentProps<"label">`. Classes updated to base-nova.
- Leftover scan clean: no `radix-ui` / `@radix-ui` references.

## Left alone
- None.

## Behavior changes
- Now a plain `<label>`; the radix `htmlFor`/form-association behavior is identical for native `<label>`. No consumer prop changes needed.

## Verify by hand
- Label still associates with its input via `htmlFor`; clicking label focuses the input.
- Disabled-group / peer-disabled opacity still applies.
