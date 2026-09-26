import { LocationsScreen } from "@/features/collector/locations-screen";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("locationsTitle");

export default function Page() {
  return <LocationsScreen />;
}
