import { SafetyCardEditor } from "@/features/administration/safety/card-editor";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("safetyTitle");

export default function Page() {
  return <SafetyCardEditor />;
}
