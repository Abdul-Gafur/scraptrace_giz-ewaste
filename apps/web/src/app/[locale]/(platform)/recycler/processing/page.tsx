import { ProcessingQueueScreen } from "@/features/recycler/processing-queue";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-processing");

export default function Page() {
  return <ProcessingQueueScreen />;
}
