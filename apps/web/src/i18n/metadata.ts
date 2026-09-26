import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { PageTitleKey } from "@/navigation/page-titles";

/** A page's browser title. The same key names the page in the mobile header. */
export async function createPageMetadata(key: PageTitleKey): Promise<Metadata> {
  const translate = await getTranslations("pages");
  return { title: translate(key) };
}
