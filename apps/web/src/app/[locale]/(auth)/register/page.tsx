import { getTranslations } from "next-intl/server";

import { PageHeading } from "@/components/ui/content";
import { RegistrationForm } from "@/features/authentication/registration-form";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("registerTitle");

export default async function RegisterPage() {
  const translate = await getTranslations("pages");
  return (
    <div className="space-y-4">
      <PageHeading description={translate("registerDescription")}>
        {translate("registerTitle")}
      </PageHeading>
      <RegistrationForm />
    </div>
  );
}
