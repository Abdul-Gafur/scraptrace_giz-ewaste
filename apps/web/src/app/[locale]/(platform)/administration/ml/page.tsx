import { createPageMetadata } from "@/i18n/metadata";
import { ModelReview } from "@/features/administration/model-review";

export const generateMetadata = () => createPageMetadata("mlTitle");

export default function Page() {
  return <ModelReview />;
}
