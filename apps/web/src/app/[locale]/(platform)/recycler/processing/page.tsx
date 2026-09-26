import { ProcessingScreen } from "@/features/recycler/processing-screen";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("processingTitle");

export default function Page() {
  return <ProcessingScreen />;
}
