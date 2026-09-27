import { getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/content";
import { Link } from "@/i18n/navigation";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("registerTitle");

/**
 * Self-registration needs a production identity provider, which is outside this demonstration.
 * The page says so plainly and offers the role sign-in instead of implying a pending feature.
 */
export default async function RegisterPage() {
  const translate = await getTranslations("pages");
  const translateRegister = await getTranslations("register");
  return (
    <div className="space-y-4">
      <PageHeading description={translate("registerDescription")}>
        {translate("registerTitle")}
      </PageHeading>
      <Alert title={translateRegister("boundaryTitle")} tone="info">
        {translateRegister("boundaryNotice")}
      </Alert>
      <Link className={buttonVariants({ block: true, size: "large" })} href="/sign-in">
        {translateRegister("openSignIn")}
      </Link>
    </div>
  );
}
