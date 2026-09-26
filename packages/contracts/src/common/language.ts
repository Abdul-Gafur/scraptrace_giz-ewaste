import { z } from "zod";

export const SupportedLanguageSchema = z.enum(["en", "fr", "ar", "pt"]);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const LANGUAGE_DIRECTION = {
  en: "ltr",
  fr: "ltr",
  ar: "rtl",
  pt: "ltr",
} as const satisfies Record<SupportedLanguage, "ltr" | "rtl">;

export const LanguageMetadataSchema = z
  .strictObject({
    language: SupportedLanguageSchema,
    direction: z.enum(["ltr", "rtl"]),
    reviewed: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.direction !== LANGUAGE_DIRECTION[value.language]) {
      context.addIssue({ code: "custom", path: ["direction"], message: "Direction must match the supported language." });
    }
  });

export const getLanguageDirection = (language: SupportedLanguage): "ltr" | "rtl" =>
  LANGUAGE_DIRECTION[language];
