# alert-dialog

2026-08-12 — golden pair via shadcn CLI (`shadcn add alert-dialog --overwrite`). Verdict: migrated.

## Changed
- `components/ui/alert-dialog.tsx`: `AlertDialog as AlertDialogPrimitive` from `radix-ui` -> `@base-ui/react/alert-dialog`. `Overlay` -> `Backdrop`, `Content` -> `Popup`, `Cancel` -> `Close`. `AlertDialogAction` reworked from `<Button asChild><AlertDialogPrimitive.Action/></Button>` to a plain `<Button>` (base-ui has no Action primitive).
- `AlertDialogCancel`: `<AlertDialogPrimitive.Cancel>` now uses `render={<Button variant size />}`.
- Customizations preserved: `AlertDialogContent` `size` prop, `AlertDialogMedia` part, header/footer/media grid classes all survived the overwrite.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui" components/ui/alert-dialog.tsx` -> no matches.

## Left alone
- None.

## Behavior changes
- `AlertDialogAction` no longer auto-closes on click (it is a plain `Button` now). NOT a regression for this project: `confirmLeaveRoom` (room-page.tsx:122) already calls `setLeaveDialogOpen(false)`.
- base-ui AlertDialog is always modal and does not close on outside press by default (parity with radix intent).

## Verify by hand
- Open "确定要离开房间吗？" alert; Cancel and 确定离开 buttons render with correct variants (outline / destructive).
- Click 确定离开: runs `confirmLeaveRoom` and the dialog closes (via `setLeaveDialogOpen(false)`).
- Escape closes the alert dialog (it is dismissable, unlike the forced dialogs).
