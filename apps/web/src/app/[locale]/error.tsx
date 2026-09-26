"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { StatusPanel } from "@/components/feedback/status-panel";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const translatePages = useTranslations("pages");
  const translateCommon = useTranslations("common");
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("Route render failure", error.name);
  }, [error]);
  return (
    <main id="main-content" className="content-container py-12">
      <StatusPanel
        title={translatePages("errorTitle")}
        description={translatePages("errorDescription")}
        tone="error"
        actionLabel={translateCommon("retry")}
        onAction={reset}
      />
    </main>
  );
}
