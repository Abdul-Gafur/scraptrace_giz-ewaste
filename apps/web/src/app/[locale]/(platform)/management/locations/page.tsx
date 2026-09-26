import { RecoveryLocations } from "@/features/management/recovery-locations";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recoveryLocationsTitle");

export default function Page() {
  return <RecoveryLocations />;
}
