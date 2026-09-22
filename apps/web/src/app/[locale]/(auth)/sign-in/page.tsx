import { getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";
import { PageHeading } from "@/components/ui/content";
import { useDevelopmentMocks } from "@/config/env";
import { RolePreview } from "@/features/authentication/role-preview";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("signInTitle");

/**
 * Development role preview (Figma "role-sign-in"). Each entry only opens a workspace so its
 * shell can be reviewed; it does not authenticate and grants no access.
 */
export default async function SignInPage() {
  const translate = await getTranslations("pages");
  const translatePreview = await getTranslations("preview");
  return (
    <div className="space-y-4">
      <PageHeading description={translate("signInDescription")}>
        {translate("signInTitle")}
      </PageHeading>
      {useDevelopmentMocks ? (
        <>
          <RolePreview />
          <Alert title={translatePreview("title")} tone="warning">
            {translatePreview("description")}
          </Alert>
        </>
      ) : (
        <Alert title={translatePreview("unavailableTitle")} tone="info">
          {translatePreview("unavailableDescription")}
        </Alert>
      )}
    </div>
  );
}
