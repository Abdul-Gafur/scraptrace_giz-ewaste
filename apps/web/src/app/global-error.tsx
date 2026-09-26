"use client";

import { useEffect } from "react";

import en from "../../messages/en.json";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development")
      console.error("Application render failure", error.name);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="content-container py-12">
          <section aria-live="assertive" className="rounded-lg border bg-white p-6">
            <h1 className="text-xl font-semibold">{en.pages.errorTitle}</h1>
            <p className="mt-2 text-sm">{en.pages.errorDescription}</p>
            <button
              className="mt-4 min-h-11 rounded-md bg-[var(--primary)] px-4 font-semibold text-white"
              onClick={reset}
              type="button"
            >
              {en.common.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
