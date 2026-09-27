import { SafetyPublishedScreen } from "@/features/administration/safety/published-screen";
import { itemMetadata } from "@/components/layout/section-placeholder";

export const generateMetadata = () => itemMetadata("safety-published");

export default function Page() {
  return <SafetyPublishedScreen />;
}
