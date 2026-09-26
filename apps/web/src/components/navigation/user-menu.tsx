"use client";

import type { UserRole } from "@scraptrace/contracts";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/content";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

/** Development-session user menu. Signing out returns to the role preview list. */
export function UserMenu({ role }: { role: UserRole }) {
  const translate = useTranslations("common");
  const translateRoles = useTranslations("roles");
  const translateShell = useTranslations("shell");
  return (
    <DropdownMenu
      header={
        <>
          <span className="text-foreground block font-bold">{translateRoles(role)}</span>
          <span className="block">{translate("developmentSession")}</span>
        </>
      }
      items={[{ id: "sign-out", label: translate("signOut"), href: "/sign-in", tone: "danger" }]}
      label={translateShell("userMenu")}
      trigger={
        <>
          <Avatar />
          <ChevronDown aria-hidden="true" className="text-muted-foreground size-4" />
        </>
      }
    />
  );
}
