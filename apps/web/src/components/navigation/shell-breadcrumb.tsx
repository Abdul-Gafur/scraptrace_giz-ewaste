"use client";

import { useTranslations } from "next-intl";

import { Breadcrumbs } from "./breadcrumbs";
import { useActiveLabel, type ResolvedNavItem } from "./nav-lists";

/** Workspace / current page trail derived from the active navigation item. */
export function ShellBreadcrumb({
  workspaceLabel,
  workspaceHref,
  items,
}: {
  workspaceLabel: string;
  workspaceHref: string;
  items: readonly ResolvedNavItem[];
}) {
  const translate = useTranslations("shell");
  const current = useActiveLabel(items);
  return (
    <Breadcrumbs
      items={
        current
          ? [{ label: workspaceLabel, href: workspaceHref }, { label: current }]
          : [{ label: workspaceLabel }]
      }
      label={translate("breadcrumbLabel")}
    />
  );
}
