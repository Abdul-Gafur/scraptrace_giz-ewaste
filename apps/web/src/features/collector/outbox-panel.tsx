"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOnlineStatus } from "@/components/feedback/connectivity";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useNumber } from "@/i18n/use-number";
import { useOutbox, useProgrammeMutation } from "@/services/queries";

/**
 * Work saved on this device that has not reached the server. Synchronization is a real action:
 * while the device is offline the queue stays, and nothing claims to have been sent.
 */
export function OutboxPanel() {
  const translate = useTranslations("screens.outbox");
  const number = useNumber();
  const online = useOnlineStatus();
  const { show } = useToast();
  const { data: pending } = useOutbox();
  const flush = useProgrammeMutation((services) => services.outbox.flush());

  const count = pending?.length ?? 0;
  if (count === 0) return null;

  return (
    <section
      aria-labelledby="outbox-heading"
      className="border-secondary bg-caution-subtle rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-warning flex items-center gap-2 text-sm font-bold" id="outbox-heading">
          <RefreshCw aria-hidden="true" className="size-5" />
          {translate("heading", { count: number(count) })}
        </h2>
        <StatusBadge status={online ? "pending_synchronization" : "offline"} />
      </div>
      <p className="text-foreground mt-2 text-xs leading-5">
        {online ? translate("onlineText") : translate("offlineText")}
      </p>
      <Button
        className="mt-3"
        disabled={!online}
        loading={flush.isPending}
        onClick={async () => {
          const result = await flush.mutateAsync(undefined);
          show({
            title: translate("flushed", { count: number(result.accepted) }),
            tone: result.remaining > 0 ? "warning" : "success",
          });
        }}
        variant="secondary"
      >
        {translate("syncNow")}
      </Button>
    </section>
  );
}
