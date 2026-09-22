"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/content";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = ["battery", "leadAcid", "crt", "boards"] as const;

/**
 * Figma: mobile-collector-ar (form and safety guidance). Validation is real; saving a record
 * belongs to the collector-journey milestone, so a valid form only reports that.
 */
export function CaptureForm() {
  const translate = useTranslations("screens.capture");
  const translatePages = useTranslations("pages");
  const { show } = useToast();
  const [serial, setSerial] = useState("");
  const [error, setError] = useState<string | undefined>();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (serial.trim().length === 0) {
      setError(translate("serialRequired"));
      return;
    }
    setError(undefined);
    show({ title: translate("valid"), tone: "info" });
  };

  return (
    <form className="max-w-2xl space-y-4" noValidate onSubmit={onSubmit}>
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("captureTitle")}</PageHeading>
      <Field error={error} label={translate("serialLabel")} required>
        {(control) => (
          <Input
            autoComplete="off"
            onChange={(event) => setSerial(event.target.value)}
            placeholder={translate("serialPlaceholder")}
            value={serial}
            {...control}
          />
        )}
      </Field>
      <Field label={translate("categoryLabel")}>
        {(control) => (
          <Select defaultValue="battery" {...control}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {translate(`categories.${category}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <InfoPanel as="h2" title={translate("safetyTitle")} tone="danger">
        {translate("safetyText")}
      </InfoPanel>
      <Button block size="large" type="submit">
        <Camera aria-hidden="true" className="size-5" />
        {translate("submit")}
      </Button>
    </form>
  );
}
