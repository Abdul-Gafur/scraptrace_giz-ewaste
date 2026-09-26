import { ReceivedScreen } from "@/features/recycler/received-screen";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("receivedTitle");

export default function Page() {
  return <ReceivedScreen />;
}
