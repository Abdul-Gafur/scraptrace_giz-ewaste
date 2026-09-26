import { createPageMetadata } from "@/i18n/metadata";
import { RecyclerHome } from "@/features/recycler/recycler-home";

export const generateMetadata = () => createPageMetadata("recyclerTitle");

export default function Page() {
  return <RecyclerHome />;
}
