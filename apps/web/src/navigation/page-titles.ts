/**
 * The title of each page, as the Figma frames show it in the mobile header ("Confirm Cleared
 * Cache", not "Account"). Metadata and the mobile header read the same entry, so a route can
 * never have one title in the browser tab and another on screen.
 */
export type PageTitleKey =
  | "collectorTitle"
  | "captureTitle"
  | "recordsTitle"
  | "recordDetailTitle"
  | "locationsTitle"
  | "profileTitle"
  | "clearCacheTitle"
  | "recyclerTitle"
  | "receivedTitle"
  | "processingTitle"
  | "recyclerAccountTitle"
  | "reviewTitle"
  | "assignedTitle"
  | "decisionsTitle"
  | "historyTitle"
  | "managementTitle"
  | "ledgerTitle"
  | "recoveryLocationsTitle"
  | "pricesTitle"
  | "reportsTitle"
  | "settingsTitle"
  | "safetyTitle"
  | "translationsTitle"
  | "approvalsTitle"
  | "publishedTitle"
  | "mlTitle"
  | "labelsTitle"
  | "modelTitle"
  | "exportsTitle"
  | "signInTitle"
  | "registerTitle"
  | "onboardingTitle"
  | "privacyTitle"
  | "accessDeniedTitle"
  | "sessionExpiredTitle";

/** Locale-less route to its key in the `pages` message namespace. */
export const ROUTE_PAGE_TITLES = {
  "/collector": "collectorTitle",
  "/collector/capture": "captureTitle",
  "/collector/records": "recordsTitle",
  "/collector/records/[recordId]": "recordDetailTitle",
  "/collector/locations": "locationsTitle",
  "/collector/profile": "profileTitle",
  "/collector/profile/clear-cache": "clearCacheTitle",
  "/recycler": "recyclerTitle",
  "/recycler/intake": "recyclerTitle",
  "/recycler/records": "receivedTitle",
  "/recycler/processing": "processingTitle",
  "/recycler/account": "recyclerAccountTitle",
  "/review": "reviewTitle",
  "/review/queue": "reviewTitle",
  "/review/assigned": "assignedTitle",
  "/review/decisions": "decisionsTitle",
  "/review/history": "historyTitle",
  "/management": "managementTitle",
  "/management/ledger": "ledgerTitle",
  "/management/locations": "recoveryLocationsTitle",
  "/management/prices": "pricesTitle",
  "/management/reports": "reportsTitle",
  "/management/settings": "settingsTitle",
  "/administration/safety": "safetyTitle",
  "/administration/safety/translations": "translationsTitle",
  "/administration/safety/approvals": "approvalsTitle",
  "/administration/safety/published": "publishedTitle",
  "/administration/ml": "mlTitle",
  "/administration/ml/labels": "labelsTitle",
  "/administration/ml/model": "modelTitle",
  "/administration/ml/exports": "exportsTitle",
} as const satisfies Record<string, PageTitleKey>;

const titles = ROUTE_PAGE_TITLES as Record<string, PageTitleKey>;

/**
 * The page title key for a locale-less pathname, if the route declares one. A dynamic segment
 * is matched by its parameter name, so `/collector/records/<id>` finds the detail title.
 */
export function getPageTitleKey(pathname: string): PageTitleKey | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (titles[normalized]) return titles[normalized];
  const segments = normalized.split("/");
  const parent = segments.slice(0, -1).join("/");
  return Object.entries(titles).find(
    ([route]) => route.startsWith(`${parent}/[`) && route.endsWith("]"),
  )?.[1];
}
