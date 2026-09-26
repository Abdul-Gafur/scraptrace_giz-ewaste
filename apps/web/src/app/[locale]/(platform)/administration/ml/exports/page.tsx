import { DataExports } from "@/features/administration/data-exports";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("exportsTitle");

export default function Page() {
  return <DataExports />;
}
