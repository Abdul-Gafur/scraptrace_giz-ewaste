import { SafetyApprovalsScreen } from "@/features/administration/safety/approvals-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("safety-approvals");

export default function Page() {
  return <SafetyApprovalsScreen />;
}
