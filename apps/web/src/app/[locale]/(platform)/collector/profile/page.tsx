import { createPageMetadata } from "@/i18n/metadata";
import { AccountScreen } from "@/features/collector/account-screen";

export const generateMetadata = () => createPageMetadata("profileTitle");

export default function Page() {
  return <AccountScreen />;
}
