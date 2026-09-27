import { RecyclerRecordsScreen } from "@/features/recycler/records-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-received");

export default function Page() {
  return <RecyclerRecordsScreen />;
}
