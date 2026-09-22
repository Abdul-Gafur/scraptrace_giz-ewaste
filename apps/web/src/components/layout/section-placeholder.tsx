import type { UserRole } from "@scraptrace/contracts";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getSectionItems, NAVIGATION_ITEMS, type NavItem } from "@/navigation/navigation-config";

import { PlaceholderPage } from "./placeholder-page";

/** Last path segment of a section route, for example `/review/history` gives `history`. */
const sectionSlug = (item: NavItem): string => item.href.split("/").at(-1) ?? "";

export const sectionParams = (role: UserRole) =>
  getSectionItems(role).map((item) => ({ section: sectionSlug(item) }));

const findSection = (role: UserRole, section: string) =>
  getSectionItems(role).find((item) => sectionSlug(item) === section);

export async function sectionMetadata(
  role: UserRole,
  params: Promise<{ locale: string; section: string }>,
): Promise<Metadata> {
  const { locale, section } = await params;
  const item = findSection(role, section);
  if (!item) return {};
  const translate = await getTranslations({ locale, namespace: "navigation" });
  return { title: translate(item.labelKey) };
}

/** Placeholder for a navigation destination that has no dedicated page yet. */
export async function SectionPlaceholder({
  role,
  params,
}: {
  role: UserRole;
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  setRequestLocale(locale);
  const item = findSection(role, section);
  if (!item) notFound();
  const translateNavigation = await getTranslations("navigation");
  const translatePlaceholder = await getTranslations("placeholder");
  return (
    <PlaceholderPage
      description={translatePlaceholder("sectionDescription")}
      itemId={item.id}
      title={translateNavigation(item.labelKey)}
    />
  );
}

/** Metadata for a dedicated route whose title is its navigation label. */
export async function itemMetadata(itemId: string): Promise<Metadata> {
  const item = NAVIGATION_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return {};
  const translate = await getTranslations("navigation");
  return { title: translate(item.labelKey) };
}

/** Placeholder for a dedicated route whose title is its navigation label. */
export async function ItemPlaceholder({ itemId }: { itemId: string }) {
  const item = NAVIGATION_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) notFound();
  const translateNavigation = await getTranslations("navigation");
  const translatePlaceholder = await getTranslations("placeholder");
  return (
    <PlaceholderPage
      description={translatePlaceholder("sectionDescription")}
      itemId={item.id}
      title={translateNavigation(item.labelKey)}
    />
  );
}
