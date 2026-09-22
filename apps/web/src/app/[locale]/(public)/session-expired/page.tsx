import { getTranslations } from "next-intl/server";

import { SecurityStateCard } from "@/features/security/security-state-card";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("sessionExpiredTitle");

export default async function Page() {
  const translate = await getTranslations("security");
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <SecurityStateCard
        actionHref="/sign-in"
        actionLabel={translate("sessionExpiredAction")}
        description={translate("sessionExpiredDescription")}
        notice={translate("sessionExpiredNotice")}
        noticeTitle={translate("sessionExpiredNoticeTitle")}
        title={translate("sessionExpiredTitle")}
        tone="warning"
      />
    </div>
  );
}
