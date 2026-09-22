import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComponentShowcase } from "@/features/dev/component-showcase";

export const metadata: Metadata = { title: "Component showcase", robots: { index: false } };

/** Development-only. The route does not exist in production builds. */
export default function ComponentShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main-content" tabIndex={-1}>
      <ComponentShowcase />
    </main>
  );
}
