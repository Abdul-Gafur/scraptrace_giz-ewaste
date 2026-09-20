import { z } from "zod";

export const CursorPaginationRequestSchema = z.strictObject({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const CursorPaginationMetaSchema = z.strictObject({
  next_cursor: z.string().min(1).max(512).nullable(),
  has_more: z.boolean(),
});

