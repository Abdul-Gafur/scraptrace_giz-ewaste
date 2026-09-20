import { getTranslations } from "next-intl/server";

import { PageLoading } from "@/components/feedback/page-loading";

export default async function Loading() {
  const translate = await getTranslations("pages");
  return <PageLoading label={translate("loading")} />;
}
