import { z } from "zod";

import { PermissionSchema } from "./permissions.js";
import { UserRoleSchema } from "./roles.js";
import { ActorReferenceSchema, UuidV7Schema } from "../common/identifiers.js";
import { SupportedLanguageSchema } from "../common/language.js";
import { UtcTimestampSchema } from "../common/timestamps.js";

/** Credentials for the local identity provider. Never logged, stored or echoed. */
export const SignInRequestSchema = z.strictObject({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

/**
 * The signed-in user as the API sees them. `actor_reference` is the value to copy into contract
 * requests; its optional scope fields are omitted, never `null`. Contains no credential,
 * password hash or session version.
 */
export const CurrentUserSchema = z.strictObject({
  user_id: UuidV7Schema,
  username: z.string().min(1).max(64),
  display_name: z.string().min(1).max(160),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  programme_ids: z.array(UuidV7Schema),
  facility_ids: z.array(UuidV7Schema),
  receiving_location_ids: z.array(UuidV7Schema),
  preferred_language: SupportedLanguageSchema,
  actor_reference: ActorReferenceSchema,
});

/**
 * Sign-in result. The session credential travels only in the HttpOnly cookie set on the same
 * response, so no bearer token is readable by browser JavaScript.
 */
export const SessionCreatedSchema = z.strictObject({
  expires_at: UtcTimestampSchema,
  user: CurrentUserSchema,
});

/** A development-only demonstration account. Never includes a password. */
export const DemoAccountSchema = z.strictObject({
  username: z.string().min(1).max(64),
  display_name: z.string().min(1).max(160),
  role: UserRoleSchema,
});

export const DemoAccountListSchema = z.array(DemoAccountSchema).max(50);

export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type SessionCreated = z.infer<typeof SessionCreatedSchema>;
export type DemoAccount = z.infer<typeof DemoAccountSchema>;
