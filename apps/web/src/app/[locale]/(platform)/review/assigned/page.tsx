import { AssignedRecords } from "@/features/review/assigned-records";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("review-assigned");

export default function Page() {
  return <AssignedRecords />;
}
