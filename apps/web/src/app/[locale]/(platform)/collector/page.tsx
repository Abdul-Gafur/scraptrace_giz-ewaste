import { createPageMetadata } from "@/i18n/metadata";
import { CollectorHome } from "@/features/collector/collector-home";

export const generateMetadata = () => createPageMetadata("collectorTitle");

export default function Page() {
  return <CollectorHome />;
}
