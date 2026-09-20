import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("reviewTitle");

export default async function ReviewPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("reviewTitle")} description={t("reviewDescription")} />;
}
