import {
  PermissionSchema,
  UserRoleSchema,
  isPermissionAllowed,
  type AuthorizationContext,
  type Permission,
  type UserRole,
} from "@scraptrace/contracts";

const role = UserRoleSchema.enum;
const permission = PermissionSchema.enum;

export interface RoutePolicy {
  readonly authenticated: boolean;
  readonly roles: readonly UserRole[];
  readonly permission?: Permission;
  readonly fallback: string;
}

export const ROUTE_POLICIES = {
  "/": { authenticated: false, roles: [], fallback: "/" },
  "/sign-in": { authenticated: false, roles: [], fallback: "/" },
  "/collector": {
    authenticated: true,
    roles: [role.collector],
    permission: permission["recovery_record:create"],
    fallback: "/sign-in",
  },
  "/recycler": {
    authenticated: true,
    roles: [role.recycler],
    permission: permission["recovery_record:view_operational"],
    fallback: "/sign-in",
  },
  "/review": {
    authenticated: true,
    roles: [role.programme_reviewer],
    permission: permission["review:evidence"],
    fallback: "/sign-in",
  },
  "/management": {
    authenticated: true,
    roles: [role.programme_manager],
    permission: permission["programme_report:view"],
    fallback: "/sign-in",
  },
  "/administration/safety": {
    authenticated: true,
    roles: [role.safety_content_administrator],
    permission: permission["safety_content:manage"],
    fallback: "/sign-in",
  },
  "/administration/ml": {
    authenticated: true,
    roles: [role.data_ml_reviewer],
    permission: permission["model_correction:review"],
    fallback: "/sign-in",
  },
} as const satisfies Record<string, RoutePolicy>;

const stripLocale = (path: string): string => path.replace(/^\/(en|fr|ar|pt)(?=\/|$)/, "") || "/";

export const getRoutePolicy = (path: string): RoutePolicy => {
  const normalized = stripLocale(path);
  const match = Object.keys(ROUTE_POLICIES)
    .sort((first, second) => second.length - first.length)
    .find((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  return match ? ROUTE_POLICIES[match as keyof typeof ROUTE_POLICIES] : ROUTE_POLICIES["/"];
};

export const canEnterRoute = ({
  path,
  userRole,
  context,
}: {
  path: string;
  userRole: UserRole | null;
  context: AuthorizationContext;
}): boolean => {
  const policy = getRoutePolicy(path);
  if (!policy.authenticated) return true;
  if (!userRole || !policy.roles.includes(userRole)) return false;
  return policy.permission ? isPermissionAllowed(userRole, policy.permission, context) : true;
};
