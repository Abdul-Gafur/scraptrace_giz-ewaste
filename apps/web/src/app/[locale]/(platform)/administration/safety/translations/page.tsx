import { SafetyTranslations } from "@/features/administration/safety-translations";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("translationsTitle");

export default function Page() {
  return <SafetyTranslations />;
}
