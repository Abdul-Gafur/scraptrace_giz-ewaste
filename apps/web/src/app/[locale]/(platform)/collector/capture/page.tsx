import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("captureTitle");

export default async function CapturePage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("captureTitle")} description={t("captureDescription")} />;
}
