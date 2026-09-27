import { LedgerScreen } from "@/features/management/ledger-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-ledger");

export default function Page() {
  return <LedgerScreen />;
}
