import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recyclerTitle");

export default async function RecyclerPage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("recyclerTitle")} description={t("recyclerDescription")} />;
}
