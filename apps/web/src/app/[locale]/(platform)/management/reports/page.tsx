import { ItemPlaceholder, itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("management-reports");

export default function Page() {
  return <ItemPlaceholder itemId="management-reports" />;
}
