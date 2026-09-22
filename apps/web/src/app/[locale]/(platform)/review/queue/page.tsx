import { createPageMetadata } from "@/i18n/metadata";
import { ReviewQueue } from "@/features/review/review-queue";

export const generateMetadata = () => createPageMetadata("reviewTitle");

export default function Page() {
  return <ReviewQueue />;
}
