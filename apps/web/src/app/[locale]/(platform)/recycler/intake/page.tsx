import { createPageMetadata } from "@/i18n/metadata";
import { IntakeScreen } from "@/features/recycler/intake-screen";

export const generateMetadata = () => createPageMetadata("recyclerTitle");

export default function Page() {
  return <IntakeScreen />;
}
