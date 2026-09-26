import { RecordsLedger } from "@/features/management/records-ledger";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("ledgerTitle");

export default function Page() {
  return <RecordsLedger />;
}
