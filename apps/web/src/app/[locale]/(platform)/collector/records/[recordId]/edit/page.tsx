import { CaptureForm } from "@/features/collector/capture/capture-screen";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("captureTitle");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <CaptureForm draftId={recordId} />;
}
