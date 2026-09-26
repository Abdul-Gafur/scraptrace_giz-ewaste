import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("locationsTitle");

export default async function LocationsPage() {
  const t = await getTranslations("pages");
  return (
    <PlaceholderPage
      itemId="collector-locations"
      title={t("locationsTitle")}
      description={t("locationsDescription")}
    />
  );
}
