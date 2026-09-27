"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

export function SignInForm() {
  const translate = useTranslations("authentication");
  const safeMessage = useSafeErrorMessage();
  const authentication = useAuthentication();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const schema = z.strictObject({
    email: z.email(translate("emailInvalid")),
    password: z.string().min(1, translate("passwordRequired")),
  });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), shouldFocusError: true });

  return (
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
      <Field error={errors.email?.message} label={translate("emailLabel")} required>
        {(control) => (
          <Input autoComplete="username" type="email" {...register("email")} {...control} />
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
  );
}
