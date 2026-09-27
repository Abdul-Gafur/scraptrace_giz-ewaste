"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { InfoPanel } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/content";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useValueFormats } from "@/features/shared/formats";
import { useClearLocalData, useLocalDataSummary } from "@/hooks/use-local-data";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * Clearing the device cache (FR-ACC-008, FR-OFF-008).
 *
 * The warning states the real counts from the device store, so it never claims to delete work that
 * is not there. Clearing removes this user's records from the device; the initial demonstration
 * data returns the next time the workspace is opened, which the notice says plainly.
 */
export function ClearCacheScreen() {
  const translate = useTranslations("screens.clearCache");
  const formats = useValueFormats();
  const { show } = useToast();
  const router = useRouter();
  const summaryQuery = useLocalDataSummary();
  const clear = useClearLocalData();

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading visuallyHiddenBelowDesktop>{translate("title")}</PageHeading>

      <AsyncPanel query={summaryQuery} skeletonRows={1}>
        {(summary) => (
          <>
            <InfoPanel as="h2" title={translate("warningTitle")} tone="danger">
              <p>
                {translate("warningText", {
                  records: formats.number(summary.records, 0),
                  drafts: formats.number(summary.drafts, 0),
                })}
              </p>
              <p className="mt-2 font-bold">{translate("warningStrong")}</p>
            </InfoPanel>

            {summary.durable ? null : (
              <Alert title={translate("notDurableTitle")} tone="warning">
                {translate("notDurable")}
              </Alert>
            )}
            {summary.storageWarning ? (
              <Alert title={translate("storageWarningTitle")} tone="warning">
                {translate(`storageWarning.${summary.storageWarning}`)}
              </Alert>
            ) : null}

            <p className="text-muted-foreground text-xs leading-5">{translate("reseedNotice")}</p>

            <div className="flex flex-col gap-2">
              <ConfirmAction
                block
                confirmLabel={translate("confirm")}
                description={translate("confirmDescription", {
                  records: formats.number(summary.records, 0),
                })}
                destructive
                label={translate("confirm")}
                loading={clear.isPending}
                onConfirm={() => {
                  clear.mutate(undefined, {
                    onSuccess: () => {
                      show({ title: translate("cleared"), tone: "success" });
                      router.push("/collector/profile");
                    },
                  });
                }}
                size="large"
                title={translate("confirmTitle")}
                variant="destructive"
              />
              <Link
                className={buttonVariants({ variant: "secondary", block: true, size: "large" })}
                href="/collector/profile"
              >
                {translate("cancel")}
              </Link>
            </div>
          </>
        )}
      </AsyncPanel>
    </div>
  );
}
