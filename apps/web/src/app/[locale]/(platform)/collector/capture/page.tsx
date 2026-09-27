import { CaptureForm } from "@/features/collector/capture/capture-screen";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("captureTitle");

export default function Page() {
  return <CaptureForm />;
}
