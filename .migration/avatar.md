# avatar

2026-08-12 — golden pair via shadcn CLI (`shadcn add avatar --overwrite`). Verdict: migrated.

## Changed
- `components/ui/avatar.tsx`: `Avatar as AvatarPrimitive` from `radix-ui` -> `@base-ui/react/avatar`. Types `React.ComponentProps<typeof AvatarPrimitive.X>` -> `AvatarPrimitive.X.Props`.
- base-nova styling: `Avatar` root gains an `after:` border ring (`after:border after:border-border after:mix-blend-darken`); `AvatarImage` gains `object-cover`. Dropped `overflow-hidden` on root (replaced by the after-ring approach).
- Customizations preserved: `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` all survived the overwrite.
- Leftover scan clean.

## Left alone
- None.

## Behavior changes
- Subtle visual change: avatar now has a 1px border ring via `::after` (nova style) instead of `overflow-hidden` clipping. Functionally identical (image still clipped to circle via `rounded-full`).

## Verify by hand
- `size="sm|default|lg"` scales correctly; `AvatarBadge` sizes follow.
- `AvatarGroup` overlaps with ring; `AvatarGroupCount` shows "+N".
- Fallback shows when image fails/still loading.
