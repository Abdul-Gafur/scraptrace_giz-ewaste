import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("profileTitle");

export default async function ProfilePage() {
  const t = await getTranslations("pages");
  return <PlaceholderPage title={t("profileTitle")} description={t("profileDescription")} />;
}
