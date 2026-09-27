import { ReviewDetail } from "@/features/review/review-detail";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("review-queue");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <ReviewDetail recordId={recordId} />;
}
