import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("collectorTitle");

export default async function CollectorPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("collectorTitle")} description={t("collectorDescription")} />;
}
