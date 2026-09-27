import { ReportsScreen } from "@/features/management/reports-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-reports");

export default function Page() {
  return <ReportsScreen />;
}
