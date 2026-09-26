import { ProgrammeSettings } from "@/features/management/programme-settings";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("settingsTitle");

export default function Page() {
  return <ProgrammeSettings />;
}
