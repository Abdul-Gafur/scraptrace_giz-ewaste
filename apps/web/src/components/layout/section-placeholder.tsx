import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NAVIGATION_ITEMS } from "@/navigation/navigation-config";

/**
 * Page metadata for a route whose title is its navigation label. Every role destination now has a
 * real screen, so no placeholder renderer remains here.
 */
export async function itemMetadata(itemId: string): Promise<Metadata> {
  const item = NAVIGATION_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return {};
  const translate = await getTranslations("navigation");
  return { title: translate(item.labelKey) };
}
