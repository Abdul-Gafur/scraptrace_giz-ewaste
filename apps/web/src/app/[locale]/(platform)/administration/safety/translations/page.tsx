import { SafetyTranslationsScreen } from "@/features/administration/safety/translations-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("safety-translations");

export default function Page() {
  return <SafetyTranslationsScreen />;
}
