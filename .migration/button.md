# button

2026-08-12 — golden pair via shadcn CLI (`shadcn add button --overwrite`). Verdict: migrated.

## Changed
- `components/ui/button.tsx`: `import { Slot } from "radix-ui"` + hand-rolled `asChild ? Slot.Root : "button"` -> `import { Button as ButtonPrimitive } from "@base-ui/react/button"`, rendering `<ButtonPrimitive>` directly. Type `React.ComponentProps<'button'> & { asChild? } & VariantProps` -> `ButtonPrimitive.Props & VariantProps`. Base classes updated to base-nova (added `active:not-aria-[haspopup]:translate-y-px`, `transition-all`; secondary variant now uses `color-mix`).
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui" components/ui/button.tsx` -> no matches.

## Left alone
- `buttonVariants` export kept (consumers import it for e.g. link styling).

## Behavior changes
- `asChild` prop removed (use `render`). No app code used `<Button asChild>`.
- `data-variant` / `data-size` attributes removed. No app code referenced them.

## Verify by hand
- Click a primary/outline/ghost button: active translate-y still feels right.
- Render-as link (`<Button render={<a/>}>`) still inherits variants.
- Disabled buttons still show `pointer-events-none opacity-50`.
