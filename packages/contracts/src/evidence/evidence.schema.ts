import { z } from "zod";

import { Sha256DigestSchema } from "../common/integrity.js";
import { EvidenceIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { CONTRACT_SCHEMA_VERSION } from "../schema-version.js";
import { ProvenanceSchema } from "./provenance.schema.js";

export const EvidenceTypeSchema = z.enum([
  "original_item_photo",
  "additional_item_photo",
  "handoff_qr_scan",
  "recycler_receipt",
  "handoff_photo",
  "weight_measurement",
  "processing_completion",
  "reviewer_decision",
]);

export const StorageReferenceSchema = z.strictObject({
  storage_provider: z.string().min(1).max(80),
  object_key: z.string().min(1).max(1024).refine((value) => !/^https?:\/\//i.test(value), {
    message: "Store an object key, not a public or signed URL.",
  }),
  object_version: z.string().min(1).max(200).optional(),
});

export const EvidenceSchema = z.strictObject({
  evidence_schema_version: z.literal(CONTRACT_SCHEMA_VERSION),
  evidence_id: EvidenceIdSchema,
  recovery_record_id: RecoveryRecordIdSchema,
  evidence_type: EvidenceTypeSchema,
  storage_reference: StorageReferenceSchema,
  mime_type: z.string().min(3).max(120).regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i),
  file_size_bytes: z.number().int().positive(),
  content_digest: Sha256DigestSchema,
  provenance: ProvenanceSchema,
  validation_status: z.enum(["pending", "accepted", "rejected", "quarantined"]),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
