import { MlExportsScreen } from "@/features/administration/ml/exports-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("ml-exports");

export default function Page() {
  return <MlExportsScreen />;
}
