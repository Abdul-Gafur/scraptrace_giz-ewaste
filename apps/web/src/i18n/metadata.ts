import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type PageMessageKey =
  | "collectorTitle"
  | "captureTitle"
  | "recordsTitle"
  | "locationsTitle"
  | "profileTitle"
  | "recyclerTitle"
  | "reviewTitle"
  | "managementTitle"
  | "safetyTitle"
  | "mlTitle"
  | "signInTitle";

export async function createPageMetadata(key: PageMessageKey): Promise<Metadata> {
  const translate = await getTranslations("pages");
  return { title: translate(key) };
}
