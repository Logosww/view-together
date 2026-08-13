# project

2026-08-12 — whole-project migration: radix-ui -> @base-ui/react, with style switch `new-york` -> `base-nova`. Strategy: golden pair via shadcn CLI (`shadcn add <component> --overwrite --yes`) after flipping `components.json` style to `base-nova`. The CLI resolved `@/lib/utils` aliases, swapped the registry `IconPlaceholder` -> lucide `XIcon`, and delivered base-ui variants. Verdict: SUCCESS — tsc, oxlint, and `next build` all clean.

## Dependency swap
- `radix-ui` removed (`pnpm remove radix-ui`, -69 transitive packages).
- `@base-ui/react` (^1.7.0) was already present; no install needed.
- `components.json` style: `new-york` -> `base-nova`.

## Components migrated (11 radix wrappers)
button, label, separator, badge, avatar, progress, switch, tabs, slider, alert-dialog, dialog — all via `shadcn add --overwrite` (base-nova + base-ui). Leftover scan clean: `grep -n "radix-ui\|@radix-ui" components/ui` -> no matches.

## Non-radix wrappers (style sync only)
card, input, skeleton, spinner updated to base-nova variants for style consistency (no radix involved, no behavior change).
sonner: intentionally untouched (third-party toast lib, hard rule).

## App-code sweep (consumer props)
- `components/room-lobby.tsx:119` `<DialogTrigger asChild>` -> `render={<Button .../>}`.
- `components/video-source.tsx:65` `<DialogTrigger asChild>` -> `render={<Button .../>}`.
- `components/room-page.tsx:179,233` `onEscapeKeyDown` / `onInteractOutside` (with `event.preventDefault()`) on DialogContent -> Root `onOpenChange(open, eventDetails)` + `eventDetails.cancel()` for reasons `escape-key` / `outside-press`.
- No `<Button asChild>`, no `forceMount`, no `delayDuration`, no popover/tooltip positioning props anywhere in app code.

## Behavior changes (flagged, not patched)
1. `AlertDialogAction` no longer auto-closes on click (base-ui has no Action primitive; it is now a plain `Button`). NOT a regression here: `confirmLeaveRoom` already calls `setLeaveDialogOpen(false)`.
2. `Button` dropped the `asChild` prop (use `render`) and the `data-variant` / `data-size` attributes. No app code referenced those attributes (only `tabs.tsx` uses `data-variant` internally).
3. `onOpenChange` signature widened to `(open, eventDetails)`; existing `() => {}` and `setX` consumers stay compatible (fewer params allowed).

## Final build
`pnpm build` (Next 16.3.0 Turbopack) — Compiled successfully in 2.6s, TypeScript passed, 5/5 static pages generated. Baseline (pre-migration) tsc was also clean.

## Remaining on Radix
0 wrappers remain on Radix (`components/ui` scan: 0 radix imports).
