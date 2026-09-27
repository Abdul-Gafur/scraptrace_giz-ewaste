import { PricesScreen } from "@/features/management/prices-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-prices");

export default function Page() {
  return <PricesScreen />;
}
