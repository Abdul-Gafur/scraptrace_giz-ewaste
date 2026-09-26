import { DecisionsAudit } from "@/features/review/decisions-audit";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("decisionsTitle");

export default function Page() {
  return <DecisionsAudit />;
}
