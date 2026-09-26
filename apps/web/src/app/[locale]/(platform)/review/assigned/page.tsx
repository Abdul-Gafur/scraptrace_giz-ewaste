import { AssignedRecords } from "@/features/review/assigned-records";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("assignedTitle");

export default function Page() {
  return <AssignedRecords />;
}
