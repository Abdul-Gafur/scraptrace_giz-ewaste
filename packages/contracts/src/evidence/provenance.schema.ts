import { z } from "zod";

import { ActorReferenceSchema, DeviceInstanceIdSchema } from "../common/identifiers.js";
import { GeoCoordinatesSchema } from "../common/geography.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { SemanticVersionSchema } from "../schema-version.js";

export const CaptureSourceSchema = z.enum([
  "in_app_camera",
  "recycler_camera",
  "document_scanner",
  "approved_demo_fixture",
  "system_generated",
]);

export const AiObservationSchema = z.strictObject({
  model_name: z.string().min(1).max(120),
  model_version: SemanticVersionSchema,
  original_prediction: z.string().min(1).max(80),
  confidence: z.number().min(0).max(1),
});

export const HumanCorrectionSchema = z.strictObject({
  original_value: z.string().min(1).max(120),
  corrected_value: z.string().min(1).max(120),
  corrected_by: ActorReferenceSchema,
  corrected_at: UtcTimestampSchema,
  reason: z.string().min(1).max(500).optional(),
});

export const ProvenanceSchema = z.strictObject({
  capture_source: CaptureSourceSchema,
  captured_by: ActorReferenceSchema,
  device_instance_id: DeviceInstanceIdSchema,
  captured_at: UtcTimestampSchema,
  server_received_at: UtcTimestampSchema.optional(),
  coordinates: GeoCoordinatesSchema.optional(),
  application_version: SemanticVersionSchema,
  connectivity: z.enum(["offline", "online"]),
  ai_observation: AiObservationSchema.optional(),
  human_correction: HumanCorrectionSchema.optional(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

