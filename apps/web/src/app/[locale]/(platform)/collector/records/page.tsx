import { createPageMetadata } from "@/i18n/metadata";
import { RecordsScreen } from "@/features/collector/records-screen";

export const generateMetadata = () => createPageMetadata("recordsTitle");

export default function Page() {
  return <RecordsScreen />;
}
