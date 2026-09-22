"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { PageHeading } from "@/components/ui/content";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";

/** Figma: SafetyContentAdminShell. Publishing requires the approval workflow (later milestone). */
export function SafetyCards() {
  const translate = useTranslations("screens.safety");
  const translatePages = useTranslations("pages");
  const cards = [
    { key: "mercury", danger: true },
    { key: "lead", danger: false },
  ] as const;
  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("safetyTitle")}</PageHeading>

      <ul className="grid gap-3 lg:grid-cols-2">
        {cards.map(({ key, danger }) => (
          <li key={key}>
            <Card className={cn("h-full", danger && "border-danger")}>
              <CardHeader className="space-y-2">
                <h2
                  className={cn(
                    "flex items-center gap-2 text-lg font-bold",
                    danger ? "text-danger" : "text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 rounded-full",
                      danger ? "bg-danger" : "bg-muted-foreground",
                    )}
                  />
                  {translate(`${key}Title`)}
                </h2>
                <p className="text-muted-foreground text-xs leading-5">{translate(`${key}Text`)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {danger ? (
                    <StatusBadge status="action_required" />
                  ) : (
                    <StatusBadge status="completed" />
                  )}
                  {danger ? <Badge>{translate("enVersion")}</Badge> : null}
                </div>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <h2 className="text-primary-dark text-lg font-bold">{translate("createTitle")}</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" noValidate>
            <Field label={translate("headlineLabel")}>
              {(control) => <Input placeholder={translate("headlinePlaceholder")} {...control} />}
            </Field>
            <Field label={translate("gearLabel")}>
              {(control) => <Input placeholder={translate("gearPlaceholder")} {...control} />}
            </Field>
            <DeferredActionButton block size="large">
              {translate("publish")}
            </DeferredActionButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
