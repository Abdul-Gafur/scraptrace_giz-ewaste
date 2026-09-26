import { SystemReports } from "@/features/management/system-reports";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("reportsTitle");

export default function Page() {
  return <SystemReports />;
}
