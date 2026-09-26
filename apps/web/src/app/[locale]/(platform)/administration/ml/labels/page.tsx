import { ApprovedLabels } from "@/features/administration/approved-labels";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("labelsTitle");

export default function Page() {
  return <ApprovedLabels />;
}
