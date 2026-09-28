"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuthentication } from "@/auth/auth-session";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSafeErrorMessage } from "@/features/shared/async-panel";
import { useRouter } from "@/i18n/navigation";
import { ROLE_WORKSPACES } from "@/navigation/navigation-config";
import { useServices } from "@/services/service-provider";

/**
 * Username and password sign-in against the API. The session is an HttpOnly cookie set by the
 * API; this form never sees or stores a credential. When the API offers development-only
 * demonstration accounts, their usernames (never passwords) can be chosen to fill the form.
 */
export function SignInForm() {
  const translate = useTranslations("authentication");
  const safeMessage = useSafeErrorMessage();
  const authentication = useAuthentication();
  const services = useServices();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const demoAccounts = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: () => services.authentication.listDemoAccounts(),
    retry: false,
  });
  const schema = z.strictObject({
    username: z.string().trim().min(1, translate("usernameRequired")).max(64),
    password: z.string().min(1, translate("passwordRequired")),
  });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), shouldFocusError: true });

  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setFormError(undefined);
          try {
            const session = await authentication.signIn(values);
            router.replace(ROLE_WORKSPACES[session.role].home);
          } catch (error) {
            setFormError(safeMessage(error));
          }
        })}
      >
        {formError ? <FormError title={formError} /> : null}
        <Field error={errors.username?.message} label={translate("usernameLabel")} required>
          {(control) => (
            <Input
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              {...register("username")}
              {...control}
            />
          )}
        </Field>
        <Field error={errors.password?.message} label={translate("passwordLabel")} required>
          {(control) => (
            <Input
              autoComplete="current-password"
              type="password"
              {...register("password")}
              {...control}
            />
          )}
        </Field>
        <Button block loading={isSubmitting} size="large" type="submit">
          {translate("submit")}
        </Button>
      </form>

      {demoAccounts.data && demoAccounts.data.length > 0 ? (
        <section aria-labelledby="demo-accounts-heading" className="space-y-2">
          <h2 className="text-sm font-bold" id="demo-accounts-heading">
            {translate("demoAccountsTitle")}
          </h2>
          <p className="text-muted-foreground text-xs leading-5">{translate("demoAccountsHint")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {demoAccounts.data.map((account) => (
              <li key={account.username}>
                <Button
                  block
                  onClick={() => {
                    setValue("username", account.username);
                    setFocus("password");
                  }}
                  variant="secondary"
                >
                  <span className="flex flex-col items-start text-start">
                    <span>{account.display_name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {account.username}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
