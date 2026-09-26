"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "./button";
import { IconButton } from "./icon-button";

export type OverlayPresentation = "dialog" | "sheet" | "drawer";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  presentation?: OverlayPresentation;
  children: ReactNode;
}

/**
 * Modal surface built on the native <dialog> element: focus is trapped, Escape closes it
 * and the rest of the page is inert while it is open. `sheet` is a bottom sheet on mobile
 * and a centred dialog from 640px; `drawer` slides in from the inline-start edge.
 */
export function Overlay({ open, onClose, title, presentation = "dialog", children }: OverlayProps) {
  const translate = useTranslations("common");
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="overlay"
      data-presentation={presentation}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="flex items-center justify-between gap-4 border-b p-2 ps-4">
        <h2 className="text-primary-dark text-lg font-bold" id={titleId}>
          {title}
        </h2>
        <IconButton icon={X} label={translate("close")} onClick={onClose} />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </dialog>
  );
}

export const Dialog = Overlay;

export function BottomSheet(props: Omit<OverlayProps, "presentation">) {
  return <Overlay presentation="sheet" {...props} />;
}

export function Drawer(props: Omit<OverlayProps, "presentation">) {
  return <Overlay presentation="drawer" {...props} />;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
}

/** Confirmation with an explicit cancel. Destructive confirmations use the danger button. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Overlay onClose={onClose} open={open} presentation="sheet" title={title}>
      <p className="text-foreground text-sm leading-6">{description}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button
          block
          loading={loading}
          onClick={onConfirm}
          variant={destructive ? "destructive" : "primary"}
        >
          {confirmLabel}
        </Button>
        <Button block onClick={onClose} variant="secondary">
          {cancelLabel}
        </Button>
      </div>
    </Overlay>
  );
}
