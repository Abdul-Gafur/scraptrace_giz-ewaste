import { createPageMetadata } from "@/i18n/metadata";
import { ClearCacheScreen } from "@/features/collector/clear-cache-screen";

export const generateMetadata = () => createPageMetadata("profileTitle");

export default function Page() {
  return <ClearCacheScreen />;
}
