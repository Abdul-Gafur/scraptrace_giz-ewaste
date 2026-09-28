"use client";

import { UserRoleSchema, type UserRole } from "@scraptrace/contracts";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAuthentication } from "@/auth/auth-session";
import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ROLE_WORKSPACES } from "@/navigation/navigation-config";

/**
 * Figma: role-sign-in. Development preview only: choosing a role creates a mock session and opens
 * that workspace's shell. This component is never rendered by the production HTTP configuration.
 */
export function RolePreview() {
  const translateRoles = useTranslations("roles");
  const translateDescriptions = useTranslations("roleDescriptions");
  const translate = useTranslations("screens.signIn");
  const [selected, setSelected] = useState<UserRole>(UserRoleSchema.enum.collector);
  const [pending, setPending] = useState(false);
  const authentication = useAuthentication();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="sr-only">{translate("groupLabel")}</legend>
        {UserRoleSchema.options.map((role) => {
          const active = role === selected;
          return (
            <label
              className={cn(
                "min-h-touch bg-surface has-[:focus-visible]:outline-focus flex cursor-pointer items-center justify-between gap-3 rounded-md border p-4 has-[:focus-visible]:outline-[length:var(--focus-ring-width)] has-[:focus-visible]:outline-offset-2",
                active ? "border-primary border-2" : "hover:bg-surface-subtle",
              )}
              key={role}
            >
              <input
                checked={active}
                className="sr-only"
                name="role"
                onChange={() => setSelected(role)}
                type="radio"
                value={role}
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{translateRoles(role)}</span>
                <span className="text-muted-foreground block text-xs">
                  {translateDescriptions(role)}
                </span>
              </span>
              {active ? (
                <span className="bg-success-subtle text-success-strong shrink-0 rounded-xs px-2 py-1 text-[0.6875rem] font-bold">
                  {translate("active")}
                </span>
              ) : (
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-5 shrink-0 rtl:rotate-180"
                />
              )}
            </label>
          );
        })}
      </fieldset>
      <button
        className={buttonVariants({ block: true, size: "large" })}
        disabled={pending}
        onClick={() => {
          setPending(true);
          void authentication
            .signIn({ demoRole: selected })
            .then(() => router.push(ROLE_WORKSPACES[selected].home))
            .finally(() => setPending(false));
        }}
        type="button"
      >
        {translate("enter")}
      </button>
    </div>
  );
}
