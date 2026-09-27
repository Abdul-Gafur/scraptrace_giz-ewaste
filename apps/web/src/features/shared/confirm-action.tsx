"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

interface ConfirmActionProps extends Omit<ButtonProps, "onClick" | "children"> {
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * A consequential action behind an explicit confirmation. The dialog is the native `<dialog>`
 * element, so focus is trapped and Escape closes it.
 */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  ...buttonProps
}: ConfirmActionProps) {
  const translate = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...buttonProps}>
        {label}
      </Button>
      <ConfirmDialog
        cancelLabel={translate("cancel")}
        confirmLabel={confirmLabel}
        description={description}
        destructive={destructive}
        loading={loading}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
        open={open}
        title={title}
      />
    </>
  );
}
