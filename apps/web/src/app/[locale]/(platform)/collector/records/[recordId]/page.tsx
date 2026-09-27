import { CollectorRecordDetail } from "@/features/collector/record-detail";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recordsTitle");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <CollectorRecordDetail recordId={recordId} />;
}
