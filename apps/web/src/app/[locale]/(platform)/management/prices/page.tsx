import { PriceReferences } from "@/features/management/price-references";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("pricesTitle");

export default function Page() {
  return <PriceReferences />;
}
