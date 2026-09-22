import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("registerTitle");

export default async function RegisterPage() {
  const translate = await getTranslations("pages");
  return (
    <PlaceholderPage
      description={translate("registerDescription")}
      title={translate("registerTitle")}
    />
  );
}
