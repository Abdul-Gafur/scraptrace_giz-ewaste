import { PublishedContent } from "@/features/administration/published-content";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("publishedTitle");

export default function Page() {
  return <PublishedContent />;
}
