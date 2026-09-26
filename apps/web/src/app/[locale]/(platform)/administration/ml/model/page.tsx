import { ModelInformation } from "@/features/administration/model-information";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("modelTitle");

export default function Page() {
  return <ModelInformation />;
}
