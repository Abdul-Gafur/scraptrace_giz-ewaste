import { z } from "zod";

export const UserRoleSchema = z.enum([
  "collector",
  "recycler",
  "programme_reviewer",
  "programme_manager",
  "safety_content_administrator",
  "data_ml_reviewer",
]);

export const TransitionActorRoleSchema = z.union([UserRoleSchema, z.literal("system")]);

export type UserRole = z.infer<typeof UserRoleSchema>;
export type TransitionActorRole = z.infer<typeof TransitionActorRoleSchema>;

