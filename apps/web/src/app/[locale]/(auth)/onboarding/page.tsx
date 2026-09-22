import { createPageMetadata } from "@/i18n/metadata";
import { LanguageChoice } from "@/features/onboarding/language-choice";

export const generateMetadata = () => createPageMetadata("onboardingTitle");

export default function Page() {
  return <LanguageChoice />;
}
