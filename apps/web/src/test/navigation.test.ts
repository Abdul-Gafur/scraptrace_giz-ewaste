import {
  PermissionSchema,
  ROLE_PERMISSIONS,
  UserRoleSchema,
  type UserRole,
} from "@scraptrace/contracts";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  NAVIGATION_ITEMS,
  ROLE_WORKSPACES,
  findActiveNavItem,
  getNavigationForRole,
  isNavItemActive,
} from "@/navigation/navigation-config";
import { ROUTE_PAGE_TITLES, getPageTitleKey } from "@/navigation/page-titles";

import en from "../../messages/en.json";
import { bundles } from "./render";

const roles = UserRoleSchema.options;

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const ids = (role: UserRole, surface?: "mobile" | "desktop") =>
  getNavigationForRole(role, surface).map((item) => item.id);

describe("navigation configuration", () => {
  it("covers exactly the roles and permissions defined in packages/contracts", () => {
    expect(Object.keys(ROLE_WORKSPACES).sort()).toEqual([...roles].sort());
    for (const item of NAVIGATION_ITEMS) {
      expect(PermissionSchema.safeParse(item.permission).success).toBe(true);
      for (const role of item.roles) expect(roles).toContain(role);
    }
  });

  it("only offers items whose permission the contract grants to the role", () => {
    for (const role of roles) {
      for (const item of getNavigationForRole(role)) {
        expect(ROLE_PERMISSIONS[role].has(item.permission)).toBe(true);
      }
    }
  });

  it("gives every role a workspace with navigation and a unique set of routes", () => {
    for (const role of roles) expect(getNavigationForRole(role).length).toBeGreaterThan(0);
    const hrefs = NAVIGATION_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.id)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it("shows each role only its own workspace", () => {
    expect(ids("collector")).toEqual([
      "collector-home",
      "collector-capture",
      "collector-records",
      "collector-locations",
      "collector-profile",
    ]);
    for (const role of roles) {
      for (const item of getNavigationForRole(role)) {
        expect(item.href.startsWith(ROLE_WORKSPACES[role].routePrefix)).toBe(true);
      }
    }
    expect(ids("programme_reviewer").some((id) => id.startsWith("collector"))).toBe(false);
  });

  it("limits the mobile bottom bar to five items", () => {
    for (const role of roles) expect(ids(role, "mobile").length).toBeLessThanOrEqual(5);
    expect(ids("programme_manager", "mobile")).not.toContain("management-prices");
    expect(ids("programme_manager", "desktop")).toContain("management-prices");
  });

  it("resolves active state, workspace roots and the most specific item", () => {
    const recycler = getNavigationForRole("recycler");
    expect(findActiveNavItem(recycler, "/recycler")?.id).toBe("recycler-intake");
    expect(findActiveNavItem(recycler, "/recycler/intake")?.id).toBe("recycler-intake");
    expect(findActiveNavItem(recycler, "/recycler/records")?.id).toBe("recycler-received");
    expect(findActiveNavItem(recycler, "/elsewhere")).toBeUndefined();
    const safety = getNavigationForRole("safety_content_administrator");
    expect(findActiveNavItem(safety, "/administration/safety/translations")?.id).toBe(
      "safety-translations",
    );
    const [home] = getNavigationForRole("collector");
    expect(home && isNavItemActive(home, "/collector/")).toBe(true);
  });

  it("gives every navigation destination a page file under its route group", () => {
    const routes = path.resolve(import.meta.dirname, "../app/[locale]/(platform)");
    for (const item of NAVIGATION_ITEMS) {
      const file = path.join(routes, item.href.replace(/^\//, ""), "page.tsx");
      expect({ href: item.href, exists: existsSync(file) }).toEqual({
        href: item.href,
        exists: true,
      });
    }
  });

  it("titles every workspace route the way its page metadata does", () => {
    const platform = path.resolve(import.meta.dirname, "../app/[locale]/(platform)");
    const routeOf = (file: string) =>
      `/${path.relative(platform, path.dirname(file)).split(path.sep).join("/")}`;

    const pages = walk(platform).filter((file) => file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(0);

    for (const file of pages) {
      const route = routeOf(file);
      const key = getPageTitleKey(route);
      // The mobile header shows the page title, so every workspace route must declare one.
      expect({ route, declared: key !== undefined }).toEqual({ route, declared: true });
      // …and it must be the key the route's own metadata uses.
      const metadata = /createPageMetadata\("([^"]+)"\)/.exec(readFileSync(file, "utf8"));
      expect({ route, key: metadata?.[1] }).toEqual({ route, key });
    }
  });

  it("points every declared page title at a real message key", () => {
    for (const bundle of Object.values(bundles)) {
      for (const key of Object.values(ROUTE_PAGE_TITLES)) {
        expect(bundle.pages).toHaveProperty(key);
      }
    }
  });

  it("has a translation for every navigation label in all four languages", () => {
    for (const bundle of Object.values(bundles)) {
      for (const item of NAVIGATION_ITEMS) {
        expect(bundle.navigation).toHaveProperty(item.labelKey);
      }
      for (const role of roles) {
        expect(bundle.workspaces).toHaveProperty(role);
        expect(bundle.roles).toHaveProperty(role);
      }
    }
    expect(en.navigation.locations).toBe("Nearby");
  });
});

describe("contract role usage", () => {
  const source = path.resolve(import.meta.dirname, "..");

  it("does not redeclare role identifiers outside packages/contracts", () => {
    const literal = new RegExp(`["'](${roles.join("|")})["']`);
    const offenders = walk(source)
      .filter((file) => /\.tsx?$/.test(file) && !file.includes(`${path.sep}test${path.sep}`))
      .filter((file) => literal.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(source, file))).toEqual([]);
  });
});
