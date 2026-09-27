import { CorrectionQueue } from "@/features/administration/ml/correction-queue";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("mlTitle");

export default function Page() {
  return <CorrectionQueue />;
}
