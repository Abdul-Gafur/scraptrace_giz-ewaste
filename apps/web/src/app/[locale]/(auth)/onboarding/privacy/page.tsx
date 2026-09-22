import { createPageMetadata } from "@/i18n/metadata";
import { PrivacyConsent } from "@/features/onboarding/privacy-consent";

export const generateMetadata = () => createPageMetadata("privacyTitle");

export default function Page() {
  return <PrivacyConsent />;
}
