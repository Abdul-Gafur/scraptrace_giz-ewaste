import { ProcessingForm } from "@/features/recycler/processing-form";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-processing");

export default async function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <ProcessingForm recordId={recordId} />;
}
