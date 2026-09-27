import { ProgrammeSettingsScreen } from "@/features/management/settings-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-settings");

export default function Page() {
  return <ProgrammeSettingsScreen />;
}
