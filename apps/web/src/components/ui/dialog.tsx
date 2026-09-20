"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { Button } from "./button";

interface DialogProps {
  trigger: ReactNode;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

export function Dialog({ trigger, title, closeLabel, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <span onClick={() => dialogRef.current?.showModal()}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="m-auto max-w-lg rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-0 text-[var(--color-text-primary)] backdrop:bg-black/35"
      >
        <div className="flex items-center justify-between gap-4 border-b p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            size="icon"
            variant="ghost"
            aria-label={closeLabel}
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}
