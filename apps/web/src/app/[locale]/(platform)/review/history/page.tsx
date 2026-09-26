import { SystemHistory } from "@/features/review/system-history";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("historyTitle");

export default function Page() {
  return <SystemHistory />;
}
