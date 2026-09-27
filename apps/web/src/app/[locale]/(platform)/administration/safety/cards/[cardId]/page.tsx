import { SafetyCardEditor } from "@/features/administration/safety/card-editor";
import { createPageMetadata } from "@/i18n/metadata";

export const generateMetadata = () => createPageMetadata("safetyTitle");

export default async function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <SafetyCardEditor cardId={cardId} />;
}
