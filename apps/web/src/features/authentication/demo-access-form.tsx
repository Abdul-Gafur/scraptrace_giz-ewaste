"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DemoAccessForm() {
  const translate = useTranslations("form");
  const [submitted, setSubmitted] = useState(false);
  const schema = z.object({
    reference: z
      .string()
      .min(1, translate("referenceRequired"))
      .min(4, translate("referenceShort")),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), shouldFocusError: true });

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(async () => {
        setSubmitted(true);
      })}
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="development-reference">
          {translate("referenceLabel")}
        </label>
        <Input
          id="development-reference"
          aria-describedby={
            errors.reference ? "development-reference-error" : "development-reference-hint"
          }
          aria-invalid={Boolean(errors.reference)}
          autoComplete="off"
          {...register("reference")}
        />
        {errors.reference ? (
          <p
            className="text-sm font-medium text-[var(--color-danger)]"
            id="development-reference-error"
            role="alert"
          >
            {errors.reference.message}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]" id="development-reference-hint">
            {translate("referenceHint")}
          </p>
        )}
      </div>
      <Button disabled={isSubmitting} type="submit">
        {translate("submit")}
      </Button>
      {submitted ? (
        <p className="text-sm font-medium text-[var(--color-success)]" role="status">
          {translate("success")}
        </p>
      ) : null}
    </form>
  );
}
