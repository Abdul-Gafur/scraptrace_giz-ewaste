import { PermissionSchema, UserRoleSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading } from "@/components/ui/content";
import { NAVIGATION_ITEMS } from "@/navigation/navigation-config";

/** Proves which role and permission a route is intended for. Not an authorization check. */
function RequirementCard({ itemId }: { itemId: string }) {
  const translate = useTranslations("placeholder");
  const translateRoles = useTranslations("roles");
  const item = NAVIGATION_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="text-primary-dark text-sm font-bold">{translate("requirementsTitle")}</h2>
      </CardHeader>
      <CardContent>
        <DefinitionList>
          <DefinitionRow term={translate("requiredRole")}>
            {item.roles.map((role) => translateRoles(UserRoleSchema.parse(role))).join(", ")}
          </DefinitionRow>
          <DefinitionRow term={translate("requiredPermission")}>
            {PermissionSchema.parse(item.permission)}
          </DefinitionRow>
        </DefinitionList>
        <p className="text-muted-foreground mt-3 text-xs leading-5">
          {translate("authorizationNote")}
        </p>
      </CardContent>
    </Card>
  );
}

export function PlaceholderPage({
  title,
  description,
  itemId,
}: {
  title: string;
  description: string;
  /** Navigation item whose role and permission requirement is displayed. */
  itemId?: string;
}) {
  return (
    <section className="max-w-3xl space-y-6">
      <PageHeading description={description}>{title}</PageHeading>
      {itemId ? <RequirementCard itemId={itemId} /> : null}
    </section>
  );
}
