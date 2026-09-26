import { ItemPlaceholder, itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("recycler-received");

export default function Page() {
  return <ItemPlaceholder itemId="recycler-received" />;
}
