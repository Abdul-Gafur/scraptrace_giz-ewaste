import { DecisionsAudit } from "@/features/review/decisions-audit";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("review-decisions");

export default function Page() {
  return <DecisionsAudit />;
}
