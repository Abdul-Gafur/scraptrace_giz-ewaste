import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recordsTitle");

export default async function RecordsPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("recordsTitle")} description={t("recordsDescription")} />;
}
