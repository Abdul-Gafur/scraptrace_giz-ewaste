import type { HandoffResponseSchema } from "@scraptrace/contracts";
import type { z } from "zod";

export type HandoffResponse = z.infer<typeof HandoffResponseSchema>;
