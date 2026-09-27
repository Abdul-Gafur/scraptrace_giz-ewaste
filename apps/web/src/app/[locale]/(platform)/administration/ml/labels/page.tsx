import { ApprovedLabelsScreen } from "@/features/administration/ml/approved-labels";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("ml-labels");

export default function Page() {
  return <ApprovedLabelsScreen />;
}
