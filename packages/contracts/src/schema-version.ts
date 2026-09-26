import { z } from "zod";

export const PACKAGE_VERSION = "0.1.0" as const;
export const CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const EVENT_SCHEMA_VERSION = "1.0.0" as const;

export const SemanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)
  .meta({ description: "Semantic version string." });

export const ContractSchemaVersionSchema = z.literal(CONTRACT_SCHEMA_VERSION);
export const EventSchemaVersionSchema = z.literal(EVENT_SCHEMA_VERSION);

export type SemanticVersion = z.infer<typeof SemanticVersionSchema>;

