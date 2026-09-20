import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DemoAccessForm } from "@/features/authentication/demo-access-form";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("signInTitle");

export default async function SignInPage() {
  const translate = await getTranslations("pages");
  return (
    <div className="content-container py-12 sm:py-20">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <h1 className="text-2xl font-semibold">{translate("signInTitle")}</h1>
          <p className="leading-6 text-[var(--color-text-secondary)]">
            {translate("signInDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <DemoAccessForm />
        </CardContent>
      </Card>
    </div>
  );
}
