import { FacilityAccount } from "@/features/recycler/facility-account";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recyclerAccountTitle");

export default function Page() {
  return <FacilityAccount />;
}
