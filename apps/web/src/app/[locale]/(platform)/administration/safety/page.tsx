import { createPageMetadata } from "@/i18n/metadata";
import { SafetyCards } from "@/features/administration/safety-cards";

export const generateMetadata = () => createPageMetadata("safetyTitle");

export default function Page() {
  return <SafetyCards />;
}
