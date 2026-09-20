import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("mlTitle");

export default async function MlPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("mlTitle")} description={t("mlDescription")} />;
}
