import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("safetyTitle");

export default async function SafetyPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("safetyTitle")} description={t("safetyDescription")} />;
}
