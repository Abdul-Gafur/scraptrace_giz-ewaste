import {
  PermissionSchema,
  ROLE_PERMISSIONS,
  UserRoleSchema,
  type Permission,
  type UserRole,
} from "@scraptrace/contracts";

/**
 * Central role-aware navigation. Components never check roles themselves: they render what
 * `getNavigationForRole` returns. Hiding an item is a usability aid, not access control;
 * every backend operation must authorize the caller independently (ADR-006, ADR-008).
 */

const role = UserRoleSchema.enum;
const permission = PermissionSchema.enum;

export type NavIconName =
  | "home"
  | "camera"
  | "records"
  | "location"
  | "account"
  | "intake"
  | "received"
  | "processing"
  | "queue"
  | "assigned"
  | "decisions"
  | "history"
  | "overview"
  | "ledger"
  | "prices"
  | "reports"
  | "settings"
  | "safety"
  | "translations"
  | "approvals"
  | "published"
  | "correction"
  | "labels"
  | "model"
  | "exports";

export type ShellKind = "collector-workspace" | "operational" | "administration";

export interface NavItem {
  readonly id: string;
  /** Key in the `navigation` message namespace. */
  readonly labelKey: string;
  /** Locale-less route. */
  readonly href: string;
  readonly icon: NavIconName;
  readonly roles: readonly UserRole[];
  /** Presence in the role's contract permission set is required to show the item. */
  readonly permission: Permission;
  /** `exact` matches only `href`; `prefix` also matches nested routes. */
  readonly match: "exact" | "prefix";
  /** Additional exact paths that mark this item active (for example a workspace root). */
  readonly alsoActiveFor?: readonly string[];
  /** Shown in the mobile bottom navigation (at most five per role). */
  readonly mobile: boolean;
  /** Shown in the desktop sidebar. */
  readonly desktop: boolean;
}

export interface RoleWorkspace {
  readonly shell: ShellKind;
  /** Locale-less workspace root. */
  readonly home: string;
  /** Key in the `workspaces` message namespace, used by breadcrumbs. */
  readonly workspaceKey: UserRole;
  /** Route group prefix that gates this workspace. */
  readonly routePrefix: string;
}

export const ROLE_WORKSPACES = {
  [role.collector]: {
    shell: "collector-workspace",
    home: "/collector",
    workspaceKey: role.collector,
    routePrefix: "/collector",
  },
  [role.recycler]: {
    shell: "operational",
    home: "/recycler",
    workspaceKey: role.recycler,
    routePrefix: "/recycler",
  },
  [role.programme_reviewer]: {
    shell: "operational",
    home: "/review",
    workspaceKey: role.programme_reviewer,
    routePrefix: "/review",
  },
  [role.programme_manager]: {
    shell: "operational",
    home: "/management",
    workspaceKey: role.programme_manager,
    routePrefix: "/management",
  },
  [role.safety_content_administrator]: {
    shell: "administration",
    home: "/administration/safety",
    workspaceKey: role.safety_content_administrator,
    routePrefix: "/administration/safety",
  },
  [role.data_ml_reviewer]: {
    shell: "administration",
    home: "/administration/ml",
    workspaceKey: role.data_ml_reviewer,
    routePrefix: "/administration/ml",
  },
} as const satisfies Record<UserRole, RoleWorkspace>;

const item = (
  definition: Omit<NavItem, "match" | "mobile" | "desktop"> &
    Partial<Pick<NavItem, "match" | "mobile" | "desktop">>,
): NavItem => ({
  match: "exact",
  mobile: true,
  desktop: true,
  ...definition,
});

const collector = [role.collector] as const;
const recycler = [role.recycler] as const;
const reviewer = [role.programme_reviewer] as const;
const manager = [role.programme_manager] as const;
const safety = [role.safety_content_administrator] as const;
const ml = [role.data_ml_reviewer] as const;

export const NAVIGATION_ITEMS: readonly NavItem[] = [
  // Collector: Home, Capture, Records, Nearby, Account (Figma mobile-collector-*)
  item({
    id: "collector-home",
    labelKey: "home",
    href: "/collector",
    icon: "home",
    roles: collector,
    permission: permission["recovery_record:create"],
  }),
  item({
    id: "collector-capture",
    labelKey: "capture",
    href: "/collector/capture",
    icon: "camera",
    roles: collector,
    permission: permission["recovery_record:create"],
  }),
  item({
    id: "collector-records",
    labelKey: "records",
    href: "/collector/records",
    icon: "records",
    roles: collector,
    permission: permission["recovery_record:create"],
  }),
  item({
    id: "collector-locations",
    labelKey: "locations",
    href: "/collector/locations",
    icon: "location",
    roles: collector,
    permission: permission["recovery_record:create"],
  }),
  item({
    id: "collector-profile",
    labelKey: "profile",
    href: "/collector/profile",
    icon: "account",
    roles: collector,
    permission: permission["recovery_record:create"],
    match: "prefix",
  }),

  // Recycler: Intake, Received, Processing, Account (Figma mobile-recycler-en)
  item({
    id: "recycler-intake",
    labelKey: "intake",
    href: "/recycler/intake",
    icon: "intake",
    roles: recycler,
    permission: permission["recovery_record:view_operational"],
    alsoActiveFor: ["/recycler"],
  }),
  item({
    id: "recycler-received",
    labelKey: "received",
    href: "/recycler/records",
    icon: "received",
    roles: recycler,
    permission: permission["recovery_record:view_operational"],
  }),
  item({
    id: "recycler-processing",
    labelKey: "processing",
    href: "/recycler/processing",
    icon: "processing",
    roles: recycler,
    permission: permission["processing:record"],
  }),
  item({
    id: "recycler-account",
    labelKey: "profile",
    href: "/recycler/account",
    icon: "account",
    roles: recycler,
    permission: permission["recovery_record:view_operational"],
  }),

  // Programme reviewer (Figma ProgrammeReviewerShell)
  item({
    id: "review-queue",
    labelKey: "reviewQueue",
    href: "/review/queue",
    icon: "queue",
    roles: reviewer,
    permission: permission["review:evidence"],
    alsoActiveFor: ["/review"],
  }),
  item({
    id: "review-assigned",
    labelKey: "assignedRecords",
    href: "/review/assigned",
    icon: "assigned",
    roles: reviewer,
    permission: permission["review:evidence"],
  }),
  item({
    id: "review-decisions",
    labelKey: "decisionsAudit",
    href: "/review/decisions",
    icon: "decisions",
    roles: reviewer,
    permission: permission["review:evidence"],
  }),
  item({
    id: "review-history",
    labelKey: "systemHistory",
    href: "/review/history",
    icon: "history",
    roles: reviewer,
    permission: permission["review:evidence"],
  }),

  // Programme manager (Figma ProgrammeManagerShell)
  item({
    id: "management-overview",
    labelKey: "overview",
    href: "/management",
    icon: "overview",
    roles: manager,
    permission: permission["programme_report:view"],
  }),
  item({
    id: "management-ledger",
    labelKey: "recordsLedger",
    href: "/management/ledger",
    icon: "ledger",
    roles: manager,
    permission: permission["programme_report:view"],
  }),
  item({
    id: "management-locations",
    labelKey: "recoveryLocations",
    href: "/management/locations",
    icon: "location",
    roles: manager,
    permission: permission["programme_report:view"],
  }),
  item({
    id: "management-prices",
    labelKey: "priceReferences",
    href: "/management/prices",
    icon: "prices",
    roles: manager,
    permission: permission["programme_report:view"],
    mobile: false,
  }),
  item({
    id: "management-reports",
    labelKey: "systemReports",
    href: "/management/reports",
    icon: "reports",
    roles: manager,
    permission: permission["programme_report:view"],
  }),
  item({
    id: "management-settings",
    labelKey: "settings",
    href: "/management/settings",
    icon: "settings",
    roles: manager,
    permission: permission["programme_report:view"],
  }),

  // Safety-content administrator (Figma SafetyContentAdminShell)
  item({
    id: "safety-cards",
    labelKey: "safetyCards",
    href: "/administration/safety",
    icon: "safety",
    roles: safety,
    permission: permission["safety_content:manage"],
  }),
  item({
    id: "safety-translations",
    labelKey: "translations",
    href: "/administration/safety/translations",
    icon: "translations",
    roles: safety,
    permission: permission["safety_content:manage"],
  }),
  item({
    id: "safety-approvals",
    labelKey: "approvalQueue",
    href: "/administration/safety/approvals",
    icon: "approvals",
    roles: safety,
    permission: permission["safety_content:manage"],
  }),
  item({
    id: "safety-published",
    labelKey: "publishedContent",
    href: "/administration/safety/published",
    icon: "published",
    roles: safety,
    permission: permission["safety_content:manage"],
  }),

  // Data and ML reviewer (Figma DataMlReviewerShell)
  item({
    id: "ml-corrections",
    labelKey: "correctionQueue",
    href: "/administration/ml",
    icon: "correction",
    roles: ml,
    permission: permission["model_correction:review"],
  }),
  item({
    id: "ml-labels",
    labelKey: "approvedLabels",
    href: "/administration/ml/labels",
    icon: "labels",
    roles: ml,
    permission: permission["model_correction:review"],
  }),
  item({
    id: "ml-model",
    labelKey: "modelInformation",
    href: "/administration/ml/model",
    icon: "model",
    roles: ml,
    permission: permission["model_performance:view"],
  }),
  item({
    id: "ml-exports",
    labelKey: "dataExports",
    href: "/administration/ml/exports",
    icon: "exports",
    roles: ml,
    permission: permission["model_correction:review"],
  }),
];

export type NavigationSurface = "mobile" | "desktop";

/** Items a role may see. Pass `surface` to restrict to the bottom bar or the sidebar. */
export function getNavigationForRole(
  userRole: UserRole,
  surface?: NavigationSurface,
): readonly NavItem[] {
  return NAVIGATION_ITEMS.filter(
    (candidate) =>
      candidate.roles.includes(userRole) &&
      ROLE_PERMISSIONS[userRole].has(candidate.permission) &&
      (surface === undefined || (surface === "mobile" ? candidate.mobile : candidate.desktop)),
  );
}

/** Whether `pathname` (locale prefix already removed) marks `navItem` as the current page. */
export function isNavItemActive(navItem: NavItem, pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (navItem.alsoActiveFor?.includes(normalized)) return true;
  if (normalized === navItem.href) return true;
  return navItem.match === "prefix" && normalized.startsWith(`${navItem.href}/`);
}

/**
 * The most specific active item, so a workspace root does not stay highlighted on a child
 * route that has its own navigation entry.
 */
export function findActiveNavItem(
  items: readonly NavItem[],
  pathname: string,
): NavItem | undefined {
  return items
    .filter((candidate) => isNavItemActive(candidate, pathname))
    .sort((first, second) => second.href.length - first.href.length)[0];
}
