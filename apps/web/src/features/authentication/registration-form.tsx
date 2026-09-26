"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRoleSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";

/**
 * No Figma frame. The role-sign-in frame supplies the visual language: one narrow column in
 * the authentication shell, one primary action. A request names the organisation and the role
 * it asks for, because the programme issues accounts rather than self-service sign-up.
 * Nothing is submitted: account creation arrives with authentication.
 */
export function RegistrationForm() {
  const translate = useTranslations("screens.register");
  const translateRoles = useTranslations("roles");
  const [submitted, setSubmitted] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(1, translate("nameRequired")),
    organisation: z.string().trim().min(1, translate("organisationRequired")),
    role: UserRoleSchema,
    code: z.string().trim().min(1, translate("codeRequired")).min(6, translate("codeShort")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    shouldFocusError: true,
    defaultValues: { role: UserRoleSchema.enum.collector },
  });

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(() => {
        setSubmitted(true);
      })}
    >
      <Field error={errors.name?.message} label={translate("nameLabel")} required>
        {(control) => (
          <Input
            autoComplete="name"
            placeholder={translate("namePlaceholder")}
            {...control}
            {...register("name")}
          />
        )}
      </Field>

      <Field error={errors.organisation?.message} label={translate("organisationLabel")} required>
        {(control) => (
          <Input
            autoComplete="organization"
            placeholder={translate("organisationPlaceholder")}
            {...control}
            {...register("organisation")}
          />
        )}
      </Field>

      <Field label={translate("roleLabel")}>
        {(control) => (
          <Select {...control} {...register("role")}>
            {UserRoleSchema.options.map((role) => (
              <option key={role} value={role}>
                {translateRoles(role)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field error={errors.code?.message} label={translate("codeLabel")} required>
        {(control) => (
          <Input
            autoComplete="off"
            placeholder={translate("codePlaceholder")}
            {...control}
            {...register("code")}
          />
        )}
      </Field>

      <Button block disabled={isSubmitting} size="large" type="submit">
        {translate("submit")}
      </Button>

      {submitted ? (
        <p className="text-primary text-sm font-semibold" role="status">
          {translate("recorded")}
        </p>
      ) : null}

      <Alert title={translate("noteTitle")} tone="info">
        {translate("noteText")}
      </Alert>

      <p className="text-muted-foreground text-xs leading-5">
        {translate("haveAccess")}{" "}
        <Link
          className="text-info font-semibold underline-offset-2 hover:underline"
          href="/sign-in"
        >
          {translate("previewLink")}
        </Link>
      </p>
    </form>
  );
}
