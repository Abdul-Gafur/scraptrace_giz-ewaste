import { getTranslations } from "next-intl/server";

import { StatusPanel } from "@/components/feedback/status-panel";

export default async function NotFound() {
  const translate = await getTranslations("pages");
  return (
    <main id="main-content" className="content-container py-12">
      <StatusPanel
        title={translate("notFoundTitle")}
        description={translate("notFoundDescription")}
      />
    </main>
  );
}
