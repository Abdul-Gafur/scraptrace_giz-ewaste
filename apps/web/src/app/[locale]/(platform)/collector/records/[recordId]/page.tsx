import { RecordDetail } from "@/features/records/record-detail";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("recordDetailTitle");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <RecordDetail recordId={recordId} />;
}
