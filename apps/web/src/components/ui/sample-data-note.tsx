import { useTranslations } from "next-intl";

/** Marks figures taken from the approved design so they are never mistaken for live records. */
export function SampleDataNote() {
  const translate = useTranslations("screens");
  return <p className="text-muted-foreground text-xs">{translate("sampleData")}</p>;
}
