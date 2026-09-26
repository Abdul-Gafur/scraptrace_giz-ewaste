import { createPageMetadata } from "@/i18n/metadata";
import { CaptureForm } from "@/features/collector/capture-form";

export const generateMetadata = () => createPageMetadata("captureTitle");

export default function Page() {
  return <CaptureForm />;
}
