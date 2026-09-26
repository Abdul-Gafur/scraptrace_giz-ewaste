"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";
import { useDeviceSummary, useProgrammeMutation } from "@/services/queries";

/**
 * Figma: clear-local-data. Clearing is real: it removes the records, the queued work and the
 * photographs held on this device. Records already accepted by the programme are not touched,
 * because this screen can only reach local storage.
 */
export function ClearCacheScreen() {
  const translate = useTranslations("screens.clearCache");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const { show } = useToast();
  const { data: summary, isPending } = useDeviceSummary();
  const [cleared, setCleared] = useState(false);

  const clear = useProgrammeMutation((services) => services.device.clearLocalData());

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("clearCacheTitle")}</PageHeading>

      <InfoPanel as="h2" title={translate("warningTitle")} tone="danger">
        {isPending || !summary ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <p>
              {translate("warningText", {
                records: number(summary.recordCount),
                drafts: number(summary.draftCount),
              })}
            </p>
            <p className="mt-2 font-bold">{translate("warningStrong")}</p>
          </>
        )}
      </InfoPanel>

      <section aria-labelledby="local-contents" className="space-y-2">
        <SectionLabel>
          <span id="local-contents">{translate("contentsHeading")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList className="text-sm">
            <DefinitionRow term={translate("recordsHeld")}>
              {number(summary?.recordCount ?? 0)}
            </DefinitionRow>
            <DefinitionRow term={translate("queuedWork")}>
              {number(summary?.queuedMutationCount ?? 0)}
            </DefinitionRow>
            <DefinitionRow term={translate("photographs")}>
              {number(summary?.photographCount ?? 0)}
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      {cleared ? (
        <InfoPanel as="h2" title={translate("clearedTitle")} tone="success">
          {translate("clearedText")}
        </InfoPanel>
      ) : null}

      <Button
        block
        loading={clear.isPending}
        onClick={async () => {
          await clear.mutateAsync(undefined);
          setCleared(true);
          show({ title: translate("clearedTitle"), tone: "success" });
        }}
        size="large"
        variant="destructive"
      >
        {translate("confirm")}
      </Button>
      <Link
        className={buttonVariants({ variant: "secondary", block: true, size: "large" })}
        href="/collector/profile"
      >
        {translate("cancel")}
      </Link>
    </div>
  );
}
