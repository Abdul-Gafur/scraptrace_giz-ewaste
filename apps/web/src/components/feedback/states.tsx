import { useTranslations } from "next-intl";

import { StatusPanel } from "./status-panel";

interface StateOverrides {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Builds props without passing explicit `undefined` (exactOptionalPropertyTypes). */
const action = ({ actionLabel, onAction }: StateOverrides) =>
  actionLabel ? { actionLabel, ...(onAction ? { onAction } : {}) } : {};

export function EmptyState(props: StateOverrides) {
  const translate = useTranslations("states");
  return (
    <StatusPanel
      description={props.description ?? translate("emptyDescription")}
      title={props.title ?? translate("emptyTitle")}
      tone="empty"
      {...action(props)}
    />
  );
}

export function ErrorState(props: StateOverrides) {
  const translate = useTranslations("states");
  return (
    <StatusPanel
      description={props.description ?? translate("errorDescription")}
      title={props.title ?? translate("errorTitle")}
      tone="error"
      {...action(props)}
    />
  );
}

export function PermissionDeniedState(props: StateOverrides) {
  const translate = useTranslations("states");
  return (
    <StatusPanel
      description={props.description ?? translate("permissionDescription")}
      title={props.title ?? translate("permissionTitle")}
      tone="permission"
      {...action(props)}
    />
  );
}
