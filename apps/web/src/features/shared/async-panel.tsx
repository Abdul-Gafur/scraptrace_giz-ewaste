"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EmptyState, ErrorState, PermissionDeniedState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrapTraceServiceError } from "@/services/http/http-client";

/**
 * One place that turns a query into the loading, empty, permission-denied and error states every
 * screen needs, so no screen renders a half-loaded list or leaks an internal error message.
 */

export function useSafeErrorMessage() {
  const translate = useTranslations("errors");
  return (error: unknown): string => {
    if (error instanceof ScrapTraceServiceError) {
      const key = error.envelope.error.message_key;
      // A message key is a translated, safe message. Without one, the envelope's own message is
      // already required to be short and free of record content.
      if (key?.startsWith("errors.")) {
        const suffix = key.slice("errors.".length);
        if (translate.has(suffix)) return translate(suffix);
      }
      return error.envelope.error.message;
    }
    if (
      error instanceof TypeError ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      return translate("networkUnavailable");
    }
    return translate("unexpected");
  };
}

export const isPermissionError = (error: unknown): boolean =>
  error instanceof ScrapTraceServiceError && error.envelope.error.code === "PERMISSION_DENIED";

interface AsyncPanelProps<Data> {
  query: UseQueryResult<Data>;
  /** Rendered when the query resolved and `isEmpty` is false. */
  children: (data: Data) => ReactNode;
  isEmpty?: (data: Data) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
}

export function AsyncPanel<Data>({
  query,
  children,
  isEmpty,
  emptyTitle,
  emptyDescription,
  skeletonRows = 3,
}: AsyncPanelProps<Data>) {
  const translateCommon = useTranslations("common");
  const safeMessage = useSafeErrorMessage();

  if (query.isPending) {
    return (
      <div aria-busy="true" className="space-y-2" role="status">
        <span className="sr-only">{translateCommon("loading")}</span>
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton className="h-16 w-full" key={index} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return isPermissionError(query.error) ? (
      <PermissionDeniedState description={safeMessage(query.error)} />
    ) : (
      <ErrorState
        actionLabel={translateCommon("retry")}
        description={safeMessage(query.error)}
        onAction={() => void query.refetch()}
      />
    );
  }
  const data = query.data as Data;
  if (isEmpty?.(data)) {
    return (
      <EmptyState
        {...(emptyTitle ? { title: emptyTitle } : {})}
        {...(emptyDescription ? { description: emptyDescription } : {})}
      />
    );
  }
  return <>{children(data)}</>;
}
