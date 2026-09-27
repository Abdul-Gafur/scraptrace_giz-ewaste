import { ManagementLocationsScreen } from "@/features/management/locations-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-locations");

export default function Page() {
  return <ManagementLocationsScreen />;
}
