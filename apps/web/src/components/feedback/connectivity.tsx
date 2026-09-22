"use client";

import type { SynchronizationState } from "@scraptrace/contracts";
import { CloudOff, RefreshCw, TriangleAlert, Cloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Browser connectivity only. It says nothing about synchronization, which is a later milestone. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Full-width offline banner (Figma amber "Offline Mode" bar). Renders only while offline. */
export function OfflineNotice({ forceVisible = false }: { forceVisible?: boolean }) {
  const translate = useTranslations("offline");
  const online = useOnlineStatus();
  if (online && !forceVisible) return null;
  return (
    <div
      className="bg-secondary text-secondary-foreground flex min-h-9 items-center gap-2 px-4 py-2 text-xs font-bold"
      role="status"
    >
      <CloudOff aria-hidden="true" className="size-4 shrink-0" />
      <span>{translate("banner")}</span>
    </div>
  );
}

/** Header connectivity dot with a text label. */
export function ConnectionIndicator({ forceOffline = false }: { forceOffline?: boolean }) {
  const translate = useTranslations("connection");
  const online = useOnlineStatus() && !forceOffline;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" role="status">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-warning")}
      />
      {online ? translate("online") : translate("offline")}
    </span>
  );
}

const syncIcons = {
  offline: CloudOff,
  pending_synchronization: Cloud,
  synchronizing: RefreshCw,
  synchronized: Cloud,
  action_required: TriangleAlert,
} as const satisfies Record<SynchronizationState, typeof Cloud>;

/** Record synchronization indicator: icon plus text, using contract synchronization states. */
export function SyncIndicator({ state }: { state: SynchronizationState }) {
  const translate = useTranslations("status");
  const Icon = syncIcons[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" role="status">
      <Icon
        aria-hidden="true"
        className={cn("size-4", state === "synchronizing" && "motion-safe:animate-spin")}
      />
      {translate(state)}
    </span>
  );
}
