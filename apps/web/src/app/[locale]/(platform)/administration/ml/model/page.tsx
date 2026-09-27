import { ModelOverview } from "@/features/administration/ml/model-overview";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("ml-model");

export default function Page() {
  return <ModelOverview />;
}
