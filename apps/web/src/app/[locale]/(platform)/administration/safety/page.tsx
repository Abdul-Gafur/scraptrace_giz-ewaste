import { SafetyCardList } from "@/features/administration/safety/card-list";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("safetyTitle");

export default function Page() {
  return <SafetyCardList />;
}
