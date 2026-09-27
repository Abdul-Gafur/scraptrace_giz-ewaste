import { RecyclerAccountScreen } from "@/features/recycler/account-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-account");

export default function Page() {
  return <RecyclerAccountScreen />;
}
