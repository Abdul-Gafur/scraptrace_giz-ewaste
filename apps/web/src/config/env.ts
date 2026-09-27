import "server-only";

import { z } from "zod";

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_API_MODE: z.enum(["mock", "http"]).default("mock"),
    NEXT_PUBLIC_API_BASE_URL: z.url().optional(),
    NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((value, context) => {
    if (value.NEXT_PUBLIC_API_MODE === "http" && !value.NEXT_PUBLIC_API_BASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_API_BASE_URL"],
        message: "NEXT_PUBLIC_API_BASE_URL is required when HTTP mode is enabled.",
      });
    }
  });

export const serverEnvironment = serverEnvironmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
});

export const publicEnvironment = publicEnvironmentSchema.parse({
  NEXT_PUBLIC_API_MODE: process.env["NEXT_PUBLIC_API_MODE"],
  NEXT_PUBLIC_API_BASE_URL: process.env["NEXT_PUBLIC_API_BASE_URL"],
  NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS: process.env["NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS"],
});

export const useDevelopmentMocks =
  serverEnvironment.NODE_ENV !== "production" && publicEnvironment.NEXT_PUBLIC_API_MODE === "mock";
