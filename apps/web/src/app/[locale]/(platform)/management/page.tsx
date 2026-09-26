import { createPageMetadata } from "@/i18n/metadata";
import { ManagementOverview } from "@/features/management/management-overview";

export const generateMetadata = () => createPageMetadata("managementTitle");

export default function Page() {
  return <ManagementOverview />;
}
