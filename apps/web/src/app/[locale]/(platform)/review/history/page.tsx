import { SystemHistory } from "@/features/review/system-history";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("review-history");

export default function Page() {
  return <SystemHistory />;
}
