import { ModelConfigurationScreen } from "@/features/administration/ml/configuration-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("ml-configuration");

export default function Page() {
  return <ModelConfigurationScreen />;
}
