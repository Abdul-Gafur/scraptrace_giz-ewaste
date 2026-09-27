import { RecyclerRecordDetail } from "@/features/recycler/record-detail";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-received");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <RecyclerRecordDetail recordId={recordId} />;
}
