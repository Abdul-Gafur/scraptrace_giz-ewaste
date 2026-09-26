"use client";

import { useTranslations } from "next-intl";

import { Button, type ButtonProps } from "./button";
import { useToast } from "./toast";

/**
 * A button for an action whose workflow belongs to a later milestone. It is fully visible and
 * keyboard-operable, and says so when used instead of doing nothing silently.
 */
export function DeferredActionButton(props: Omit<ButtonProps, "onClick">) {
  const translate = useTranslations("screens");
  const { show } = useToast();
  return <Button onClick={() => show({ title: translate("deferred"), tone: "info" })} {...props} />;
}
