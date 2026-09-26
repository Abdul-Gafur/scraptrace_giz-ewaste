import { ApprovalQueue } from "@/features/administration/approval-queue";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("approvalsTitle");

export default function Page() {
  return <ApprovalQueue />;
}
