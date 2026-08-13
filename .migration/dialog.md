# dialog

2026-08-12 — golden pair via shadcn CLI (`shadcn add dialog --overwrite`). Verdict: migrated.

## Changed
- `components/ui/dialog.tsx`: `Dialog as DialogPrimitive` from `radix-ui` -> `@base-ui/react/dialog`. `Overlay` -> `Backdrop` (`DialogPrimitive.Backdrop`), `Content` -> `Popup` (`DialogPrimitive.Popup`). Types `React.ComponentProps<typeof DialogPrimitive.X>` -> `DialogPrimitive.X.Props`.
- Close button: `<DialogPrimitive.Close asChild><Button.../></...>` -> `<DialogPrimitive.Close render={<Button .../>}>...</>`.
- Registry `IconPlaceholder` was auto-replaced by the CLI with `XIcon` from `lucide-react` (matches the project's icon library).
- Customization preserved: `DialogContent` `showCloseButton` prop (default `true`) and `DialogFooter` `showCloseButton` prop (default `false`) both survived the overwrite.
- `components/room-lobby.tsx:119`, `components/video-source.tsx:65`: `<DialogTrigger asChild><Button/></...>` -> `<DialogTrigger render={<Button .../>}>...children...</DialogTrigger>`.
- `components/room-page.tsx:179,233`: `onEscapeKeyDown`/`onInteractOutside` with `preventDefault()` -> Root `onOpenChange={(open, ed) => { if (!open && (ed.reason==='escape-key'||ed.reason==='outside-press')) ed.cancel(); }}`.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" components/ui/dialog.tsx` -> no matches.

## Left alone
- `sonner.tsx` (third-party, hard rule).

## Behavior changes
- `onEscapeKeyDown` / `onInteractOutside` / `onInteractOutside` no longer exist on Content; they moved to Root `onOpenChange` reasons + `eventDetails.cancel()`. Faithfully translated for the two forced (non-dismissable) dialogs.
- Centered modal uses Popup without a Positioner (per base-ui), same as before.

## Verify by hand
- Open the "加入房间" / "选择视频源" dialogs from their Button triggers; confirm trigger renders as a button, opens on click, closes on overlay press + Escape.
- "设置昵称" / "房间已关闭" dialogs must NOT close on Escape or outside click (forced).
- Close (X) button top-right still closes; `showCloseButton={false}` hides it.
