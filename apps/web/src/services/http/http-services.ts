import {
  CONTRACT_SCHEMA_VERSION,
  CurrentUserSchema,
  DemoAccountListSchema,
  ErrorEnvelopeSchema,
  EvidenceIdSchema,
  EvidenceMetadataListSchema,
  EvidenceMetadataSchema,
  EvidenceUploadRequestSchema,
  HandoffLookupRequestSchema,
  HandoffLookupResponseSchema,
  HandoffRequestSchema,
  HandoffResponseSchema,
  IDEMPOTENT_OPERATIONS,
  IdempotencyKeySchema,
  MaterialEntrySchema,
  MaterialEntryUpdateSchema,
  ProcessingDetailSchema,
  ProcessingDraftUpdateSchema,
  ProcessingRequestSchema,
  ProcessingResponseSchema,
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  ProgrammeViewSchema,
  ProtectedEvidenceDeliverySchema,
  QrCredentialsSchema,
  ReceivingLocationListSchema,
  RecordSubmissionResponseSchema,
  RecoveryRecordDraftCreateSchema,
  RecoveryRecordDraftUpdateSchema,
  RecoveryRecordEventListSchema,
  RecoveryRecordListRequestSchema,
  RecoveryRecordPageSchema,
  RecoveryRecordSchema,
  ReviewCaseDetailSchema,
  ReviewCasePageSchema,
  ReviewQueueFiltersSchema,
  ReviewReasonForReviewSchema,
  SessionCreatedSchema,
  SignInRequestSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  serviceSuccessSchema,
  type CurrentUser,
  type EvidenceMetadata,
  type JsonValue,
  type ProcessingDetail,
  type RecoveryRecord,
} from "@scraptrace/contracts";
import { z } from "zod";

import { APPLICATION_VERSION, deviceInstanceId } from "@/services/domain/device";
import { sha256Blob, sha256Json } from "@/services/domain/digest";
import { newEvidenceId, newRecoveryRecordId } from "@/services/domain/identifiers";
import { classifyPresentedCode } from "@/services/domain/qr-payload";
import { nowUtc } from "@/services/domain/time";
import type {
  AddEvidenceInput,
  CaptureInput,
  FrontendServices,
  HandoffLookupResult,
  PresentedCredential,
  ProcessingDraftInput,
  RecordHandoffInput,
  RecordProcessingInput,
  ReviewDecisionInput,
  Session,
  UpdateDraftInput,
} from "@/services/ports/service-ports";

import { HttpClient, ScrapTraceServiceError } from "./http-client";

/** Largest number of pages a dashboard aggregation follows before stopping. */
const AGGREGATION_PAGE_LIMIT = 10;
const PAGE_SIZE = 100;

const envelope = <T extends z.ZodType>(data: T) => serviceSuccessSchema(data);

/** A capability deliberately deferred to a later phase: stated plainly, never retried. */
const notAvailable = async (): Promise<never> => {
  throw new ScrapTraceServiceError(
    ErrorEnvelopeSchema.parse({
      success: false,
      contract_version: CONTRACT_SCHEMA_VERSION,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "This capability is not available in this release.",
        retryable: false,
      },
      meta: { correlation_id: "web-not-available", timestamp: nowUtc() },
    }),
  );
};

const statusOf = (error: unknown): number | undefined =>
  error instanceof ScrapTraceServiceError ? error.status : undefined;

const errorCodeOf = (error: unknown): string | undefined =>
  error instanceof ScrapTraceServiceError ? error.envelope.error.code : undefined;

const query = (values: Record<string, string | number | readonly string[] | undefined>) => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(name, String(item));
    } else {
      params.set(name, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

const ifMatch = (revision: number) => ({ "If-Match": `"${revision}"` });

const toSession = (user: CurrentUser): Session => ({
  actorId: user.user_id,
  role: user.role,
  preferredLanguage: user.preferred_language,
  displayLabel: user.display_name,
  developmentOnly: false,
  actorReference: user.actor_reference,
  programmeIds: user.programme_ids,
  facilityIds: user.facility_ids,
  receivingLocationIds: user.receiving_location_ids,
});

/** A stable key for one logical command: identical content retries replay the first result. */
const idempotencyFor = async (
  operation: string,
  recordId: string,
  actorId: string,
  content: JsonValue,
) => {
  const requestDigest = await sha256Json(content);
  return {
    idempotency_key: IdempotencyKeySchema.parse(
      `${operation}:${recordId}:${requestDigest.slice(7, 39)}`,
    ),
    request_digest: requestDigest,
    scope: { actor_id: actorId, operation, resource_id: recordId },
  };
};

const toJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

/** A component-local data URL for protected content; never a permanent or public URL. */
const blobToDataUrl = async (blob: Blob, contentType: string): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
};

const integrityFailure = () =>
  new ScrapTraceServiceError(
    ErrorEnvelopeSchema.parse({
      success: false,
      contract_version: CONTRACT_SCHEMA_VERSION,
      error: {
        code: "INTEGRITY_FAILURE",
        message: "The evidence content does not match its recorded digest.",
        retryable: false,
      },
      meta: { correlation_id: "web-integrity-check", timestamp: nowUtc() },
    }),
  );

const sameJson = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export const createHttpServices = (apiBaseUrl: string): FrontendServices => {
  const client = new HttpClient(apiBaseUrl);

  // The signed-in user, restored from the HttpOnly session cookie. Only identity and scope are
  // kept in memory; the credential itself is never readable by this code.
  let currentUser: Promise<CurrentUser> | null = null;
  const me = (): Promise<CurrentUser> => {
    currentUser ??= client
      .requestParsed("/v1/auth/me", envelope(CurrentUserSchema), { method: "GET" })
      .then((response) => response.data)
      .catch((error: unknown) => {
        currentUser = null;
        throw error;
      });
    return currentUser;
  };
  const programmeId = async () => {
    const [id] = (await me()).programme_ids;
    if (!id) throw new Error("The signed-in account has no programme assignment.");
    return id;
  };

  // Client identifiers and capture times chosen once per photograph, so a retried upload or
  // draft creation repeats exactly the same request and replays instead of duplicating.
  const evidenceIds = new WeakMap<Blob, string>();
  const evidenceIdFor = (image: Blob) => {
    const existing = evidenceIds.get(image);
    if (existing) return existing;
    const created = newEvidenceId();
    evidenceIds.set(image, created);
    return created;
  };
  const drafts = new WeakMap<
    Blob,
    { readonly recordId: string; readonly evidenceId: string; readonly at: string }
  >();

  const getRecord = async (recordId: string) =>
    (
      await client.requestParsed(
        `/v1/recovery-records/${encodeURIComponent(recordId)}`,
        envelope(RecoveryRecordSchema),
        { method: "GET" },
      )
    ).data;

  const listPage = async (request: z.input<typeof RecoveryRecordListRequestSchema>) => {
    const parsed = RecoveryRecordListRequestSchema.parse(request);
    return (
      await client.requestParsed(
        `/v1/recovery-records${query({
          limit: parsed.limit,
          cursor: parsed.cursor,
          state: parsed.state,
          category: parsed.category,
          captured_from: parsed.captured_from,
          captured_to: parsed.captured_to,
          sort: parsed.sort,
        })}`,
        envelope(RecoveryRecordPageSchema),
        { method: "GET" },
      )
    ).data;
  };

  const aggregate = async (): Promise<readonly RecoveryRecord[]> => {
    const records: RecoveryRecord[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < AGGREGATION_PAGE_LIMIT; page += 1) {
      const result = await listPage({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
      records.push(...result.items);
      if (!result.pagination.has_more || !result.pagination.next_cursor) break;
      cursor = result.pagination.next_cursor;
    }
    return records;
  };

  const addEvidence = async (
    recordId: string,
    input: AddEvidenceInput,
  ): Promise<EvidenceMetadata> => {
    const fields = EvidenceUploadRequestSchema.parse({
      evidence_type: input.evidenceType,
      evidence_id: evidenceIdFor(input.image),
      captured_at: nowUtc(),
      capture_source:
        input.evidenceType === "additional_item_photo" ? "in_app_camera" : "recycler_camera",
      device_instance_id: deviceInstanceId(),
      connectivity: input.offline ? "offline" : "online",
      application_version: APPLICATION_VERSION,
    });
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, String(value));
    form.append("image", input.image, "evidence-upload");
    return (
      await client.requestParsed(
        `/v1/recovery-records/${encodeURIComponent(recordId)}/evidence`,
        envelope(EvidenceMetadataSchema),
        { method: "POST", body: form },
      )
    ).data;
  };

  const getProcessingDetail = async (recordId: string) => {
    try {
      return await client.requestWithHeaders(
        `/v1/recovery-records/${encodeURIComponent(recordId)}/processing`,
        envelope(ProcessingDetailSchema),
        { method: "GET" },
      );
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  };

  const decide = (request: z.input<typeof ProgrammeReviewRequestSchema>) => {
    const parsed = ProgrammeReviewRequestSchema.parse(request);
    return client
      .requestParsed("/v1/review-decisions", envelope(ProgrammeReviewResponseSchema), {
        method: "POST",
        body: parsed,
      })
      .then((response) => response.data);
  };

  const recordHandoff = (request: z.input<typeof HandoffRequestSchema>) => {
    const parsed = HandoffRequestSchema.parse(request);
    return client
      .requestParsed("/v1/handoffs", envelope(HandoffResponseSchema), {
        method: "POST",
        body: parsed,
      })
      .then((response) => response.data);
  };

  const recordProcessing = (request: z.input<typeof ProcessingRequestSchema>) => {
    const parsed = ProcessingRequestSchema.parse(request);
    return client
      .requestParsed("/v1/processing-submissions", envelope(ProcessingResponseSchema), {
        method: "POST",
        body: parsed,
      })
      .then((response) => response.data);
  };

  const getCase = async (caseId: string) =>
    (
      await client.requestParsed(
        `/v1/review-cases/${encodeURIComponent(caseId)}`,
        envelope(ReviewCaseDetailSchema),
        { method: "GET" },
      )
    ).data;

  const credentialFields = (credential: PresentedCredential) =>
    credential.kind === "qr_token"
      ? { lookup_token: credential.lookupToken }
      : { manual_transfer_code: credential.code };

  return {
    authentication: {
      async getSession() {
        try {
          return toSession(await me());
        } catch (error) {
          if (statusOf(error) === 401) return null;
          throw error;
        }
      },
      async signIn(input) {
        const credentials = SignInRequestSchema.parse({
          username: input.username?.trim().toLowerCase(),
          password: input.password,
        });
        const response = await client.requestParsed(
          "/v1/auth/sessions",
          envelope(SessionCreatedSchema),
          { method: "POST", body: credentials, suppressSessionExpiry: true },
        );
        currentUser = Promise.resolve(response.data.user);
        return toSession(response.data.user);
      },
      async signOut() {
        try {
          await client.request("/v1/auth/sessions/current", { method: "DELETE" });
        } finally {
          currentUser = null;
        }
      },
      async listDemoAccounts() {
        try {
          return (
            await client.requestParsed("/v1/auth/demo-accounts", envelope(DemoAccountListSchema), {
              method: "GET",
              suppressSessionExpiry: true,
            })
          ).data;
        } catch (error) {
          if (statusOf(error) === 404) return [];
          throw error;
        }
      },
    },
    reference: {
      async getProgramme() {
        return (
          await client.requestParsed(
            `/v1/programmes/${encodeURIComponent(await programmeId())}`,
            envelope(ProgrammeViewSchema),
            { method: "GET" },
          )
        ).data;
      },
      async listDestinations() {
        return (
          await client.requestParsed(
            `/v1/programmes/${encodeURIComponent(await programmeId())}/receiving-locations`,
            envelope(ReceivingLocationListSchema),
            { method: "GET" },
          )
        ).data;
      },
      async listReceivingLocations() {
        const user = await me();
        const lists = await Promise.all(
          user.facility_ids.map(
            async (facilityId) =>
              (
                await client.requestParsed(
                  `/v1/facilities/${encodeURIComponent(facilityId)}/receiving-locations`,
                  envelope(ReceivingLocationListSchema),
                  { method: "GET" },
                )
              ).data,
          ),
        );
        const allowed = new Set(user.receiving_location_ids);
        return lists.flat().filter((location) => allowed.has(location.location_id));
      },
    },
    recoveryRecords: {
      listOwn: aggregate,
      listOperational: aggregate,
      listPage,
      async getById(recordId) {
        try {
          return await getRecord(recordId);
        } catch (error) {
          if (statusOf(error) === 404) return null;
          throw error;
        }
      },
      async createDraft(input: CaptureInput) {
        const [user, programme] = await Promise.all([
          me(),
          client
            .requestParsed(
              `/v1/programmes/${encodeURIComponent(await programmeId())}`,
              envelope(ProgrammeViewSchema),
              { method: "GET" },
            )
            .then((response) => response.data),
        ]);
        const identity = drafts.get(input.image) ?? {
          recordId: newRecoveryRecordId(),
          evidenceId: evidenceIdFor(input.image),
          at: input.capturedAt ?? nowUtc(),
        };
        drafts.set(input.image, identity);
        const metadata = RecoveryRecordDraftCreateSchema.parse({
          record_id: identity.recordId,
          device_instance_id: deviceInstanceId(),
          record_kind: input.category === "mixed_scrap" ? "batch" : "item",
          category: input.category,
          condition: input.condition,
          ...(input.itemCount === undefined ? {} : { item_count: input.itemCount }),
          ...(input.approximateWeight ? { approximate_weight: input.approximateWeight } : {}),
          captured_at: identity.at,
          ...(input.captureLocation ? { capture_location: input.captureLocation } : {}),
          approximate_area: {
            label: input.areaLabel,
            ...(input.administrativeArea ? { administrative_area: input.administrativeArea } : {}),
            country_code: programme.country_code,
          },
          ...(input.visionResult ? { vision_result: input.visionResult } : {}),
          category_confirmation: {
            confirmed_category: input.category,
            confirmed_by: user.actor_reference,
            confirmed_at: identity.at,
            source: input.confirmationSource,
            ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
          },
          ...(input.estimatedPrice ? { estimated_price: input.estimatedPrice } : {}),
          ...(input.destinationLocationId
            ? { destination_location_id: input.destinationLocationId }
            : {}),
          original_image: {
            evidence_id: identity.evidenceId,
            captured_at: identity.at,
            capture_source: "in_app_camera",
            connectivity: input.offline ? "offline" : "online",
            application_version: APPLICATION_VERSION,
          },
        });
        const digest = await sha256Json(toJson(metadata));
        const form = new FormData();
        form.append("record", JSON.stringify(metadata));
        form.append("original_image", input.image, "original-image");
        return (
          await client.requestParsed("/v1/recovery-records", envelope(RecoveryRecordSchema), {
            method: "POST",
            body: form,
            idempotencyKey: IdempotencyKeySchema.parse(
              `${IDEMPOTENT_OPERATIONS.createRecord}:${identity.recordId}:${digest.slice(7, 23)}`,
            ),
          })
        ).data;
      },
      async updateDraft(recordId, input: UpdateDraftInput) {
        const user = await me();
        let record = await getRecord(recordId);
        const revision = input.baseRevision ?? record.revision;
        const area = {
          label: input.areaLabel,
          ...(input.administrativeArea ? { administrative_area: input.administrativeArea } : {}),
          country_code: record.approximate_area.country_code,
        };
        const desired: Record<string, unknown> = {
          condition: input.condition,
          item_count: input.itemCount ?? null,
          approximate_weight: input.approximateWeight ?? null,
          capture_location: input.captureLocation ?? null,
          approximate_area: area,
          estimated_price: input.estimatedPrice ?? null,
          destination_location_id: input.destinationLocationId ?? null,
        };
        const current: Record<string, unknown> = {
          condition: record.condition,
          item_count: record.item_count ?? null,
          approximate_weight: record.approximate_weight ?? null,
          capture_location: record.capture_location ?? null,
          approximate_area: record.approximate_area,
          estimated_price: record.estimated_price ?? null,
          destination_location_id: record.destination?.location_id ?? null,
        };
        const patch = Object.fromEntries(
          Object.entries(desired).filter(([name, value]) => !sameJson(value, current[name])),
        );
        // The original prediction is kept as received: it may be associated once, never replaced.
        if (input.visionResult && !record.vision_result)
          patch["vision_result"] = input.visionResult;
        if (Object.keys(patch).length > 0) {
          record = (
            await client.requestParsed(
              `/v1/recovery-records/${encodeURIComponent(recordId)}`,
              envelope(RecoveryRecordSchema),
              {
                method: "PATCH",
                body: RecoveryRecordDraftUpdateSchema.parse(patch),
                headers: ifMatch(revision),
              },
            )
          ).data;
        } else if (revision !== record.revision) {
          throw new ScrapTraceServiceError(
            ErrorEnvelopeSchema.parse({
              success: false,
              contract_version: CONTRACT_SCHEMA_VERSION,
              error: {
                code: "VERSION_CONFLICT",
                message: "The record changed before this action completed.",
                retryable: false,
              },
              meta: { correlation_id: "web-version-check", timestamp: nowUtc() },
            }),
            409,
          );
        }
        const confirmation = record.category_confirmation;
        if (
          confirmation.confirmed_category !== input.category ||
          confirmation.source !== input.confirmationSource ||
          (confirmation.correction_reason ?? "") !== (input.correctionReason ?? "")
        ) {
          record = (
            await client.requestParsed(
              `/v1/recovery-records/${encodeURIComponent(recordId)}/category-confirmations`,
              envelope(RecoveryRecordSchema),
              {
                method: "POST",
                body: {
                  confirmed_category: input.category,
                  confirmed_by: user.actor_reference,
                  confirmed_at: nowUtc(),
                  source: input.confirmationSource,
                  ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
                },
                headers: ifMatch(record.revision),
              },
            )
          ).data;
        }
        if (input.image) {
          await addEvidence(recordId, {
            evidenceType: "additional_item_photo",
            image: input.image,
            offline: input.offline,
          });
        }
        return record;
      },
      async submit(recordId) {
        const result = (
          await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}/submissions`,
            envelope(RecordSubmissionResponseSchema),
            { method: "POST" },
          )
        ).data;
        return result.outcome === "duplicate_image"
          ? { outcome: result.outcome, record: result.record, flagCodes: result.flag_codes }
          : { outcome: result.outcome, record: result.record, replayed: result.replayed };
      },
      async getQrCredentials(recordId) {
        return (
          await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}/qr-credentials`,
            envelope(QrCredentialsSchema),
            { method: "GET" },
          )
        ).data;
      },
      async reissueQrCredentials(recordId) {
        return (
          await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}/qr-token-rotations`,
            envelope(QrCredentialsSchema),
            { method: "POST" },
          )
        ).data;
      },
      async lookupForHandoff(scannedTextOrCode): Promise<HandoffLookupResult> {
        const presented = classifyPresentedCode(scannedTextOrCode);
        if (presented.kind === "unrecognised") return { outcome: "not_found" };
        const body = HandoffLookupRequestSchema.parse(
          presented.kind === "qr_text"
            ? { qr_text: presented.text }
            : { manual_transfer_code: presented.code },
        );
        let result;
        try {
          result = (
            await client.requestParsed(
              "/v1/handoff-lookups",
              envelope(HandoffLookupResponseSchema),
              {
                method: "POST",
                body,
              },
            )
          ).data;
        } catch (error) {
          if (statusOf(error) === 404) return { outcome: "not_found" };
          if (errorCodeOf(error) === "UNSUPPORTED_CONTRACT_VERSION") {
            return { outcome: "unsupported_contract_version" };
          }
          if (errorCodeOf(error) === "VALIDATION_FAILED") return { outcome: "not_found" };
          throw error;
        }
        if (result.outcome === "already_received") {
          return { outcome: result.outcome, record: result.record, receivedAt: result.received_at };
        }
        if (result.outcome === "ready") {
          const credential: PresentedCredential | null =
            presented.kind === "manual_transfer_code"
              ? { kind: "manual_transfer_code", code: presented.code }
              : presented.payload
                ? { kind: "qr_token", lookupToken: presented.payload.lookup_token }
                : null;
          return credential
            ? { outcome: "ready", record: result.record, credential }
            : { outcome: "not_found" };
        }
        return result;
      },
      listEvents: async (recordId) =>
        (
          await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}/events`,
            envelope(RecoveryRecordEventListSchema),
            { method: "GET" },
          )
        ).data,
      listEvidence: async (recordId) =>
        (
          await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}/evidence`,
            envelope(EvidenceMetadataListSchema),
            { method: "GET" },
          )
        ).data,
      addEvidence,
      async getEvidenceImage(evidenceId) {
        let response;
        try {
          response = await client.requestBlob(
            `/v1/evidence/${encodeURIComponent(EvidenceIdSchema.parse(evidenceId))}/content`,
            { method: "GET", headers: { Accept: "image/*" } },
          );
        } catch (error) {
          if (statusOf(error) === 404 || statusOf(error) === 403) return null;
          throw error;
        }
        const delivery = ProtectedEvidenceDeliverySchema.safeParse({
          content_type: (response.headers.get("content-type") ?? "").split(";")[0]?.trim(),
          cache_control: response.headers.get("cache-control"),
          content_digest: response.headers.get("x-content-digest"),
        });
        if (!delivery.success) throw integrityFailure();
        if (
          globalThis.crypto?.subtle &&
          (await sha256Blob(response.blob)) !== delivery.data.content_digest
        ) {
          throw integrityFailure();
        }
        return delivery.data.content_type.startsWith("image/")
          ? blobToDataUrl(response.blob, delivery.data.content_type)
          : null;
      },
    },
    vision: {
      async appraise(request) {
        const { image, ...domainRequest } = request;
        const parsed = VisionAppraisalRequestSchema.parse(domainRequest);
        const form = new FormData();
        const uploadName =
          typeof File !== "undefined" && image instanceof File ? image.name : "upload";
        form.append("image", image, uploadName);
        form.append("evidence_id", parsed.evidence_id);
        const payload = await client.request("/v1/vision/appraise", {
          method: "POST",
          body: form,
        });
        return VisionAppraisalResponseSchema.parse(payload);
      },
    },
    safetyGuidance: { getGuidance: notAvailable },
    locations: { search: notAvailable },
    handoffs: {
      record: recordHandoff,
      async confirmReceipt(input: RecordHandoffInput) {
        const user = await me();
        const [handoffPhoto, weightPhoto] = await Promise.all([
          addEvidence(input.recordId, {
            evidenceType: "handoff_photo",
            image: input.evidence.handoffPhoto,
            offline: input.offline,
          }),
          addEvidence(input.recordId, {
            evidenceType: "weight_measurement",
            image: input.evidence.weightPhoto,
            offline: input.offline,
          }),
        ]);
        const content = {
          recovery_record_id: input.recordId,
          ...credentialFields(input.credential),
          collector_reference: input.collectorReference,
          recycler_reference: user.actor_reference,
          receiving_location_id: input.receivingLocationId,
          confirmed_category: input.confirmedCategory,
          confirmed_condition: input.confirmedCondition,
          measured_weight: input.measuredWeight,
          final_price: { amount: input.finalPriceAmount, currency: input.finalPriceCurrency },
          evidence_ids: [handoffPhoto.evidence_id, weightPhoto.evidence_id],
          ...(input.notes ? { notes: input.notes } : {}),
        };
        return recordHandoff({
          ...content,
          handoff_time: nowUtc(),
          idempotency: await idempotencyFor(
            IDEMPOTENT_OPERATIONS.recordHandoff,
            input.recordId,
            user.user_id,
            toJson(content),
          ),
        });
      },
    },
    processing: {
      record: recordProcessing,
      async submitProcessing(input: RecordProcessingInput) {
        const user = await me();
        const evidenceIdsForSubmission = input.completionEvidence
          ? [
              (
                await addEvidence(input.recordId, {
                  evidenceType: "processing_completion",
                  image: input.completionEvidence,
                  offline: input.offline,
                })
              ).evidence_id,
            ]
          : [...(input.completionEvidenceIds ?? [])];
        const content = {
          recovery_record_id: input.recordId,
          recycler_reference: user.actor_reference,
          processing_method: input.method,
          material_entries: input.materialEntries.map((entry) =>
            MaterialEntrySchema.parse({ material: entry.material, weight: entry.weight }),
          ),
          processing_timestamp: input.processedAt,
          completion_evidence_ids: evidenceIdsForSubmission,
          notes: input.notes,
        };
        return recordProcessing({
          ...content,
          idempotency: await idempotencyFor(
            IDEMPOTENT_OPERATIONS.recordProcessing,
            input.recordId,
            user.user_id,
            toJson(content),
          ),
        });
      },
      async listQueue(request) {
        return (
          await client.requestParsed(
            `/v1/processing-queue${query({ limit: request.limit ?? 25, cursor: request.cursor })}`,
            envelope(RecoveryRecordPageSchema),
            { method: "GET" },
          )
        ).data;
      },
      async getDraft(recordId) {
        return (await getProcessingDetail(recordId))?.body.data ?? null;
      },
      async saveDraft(recordId, input: ProcessingDraftInput): Promise<ProcessingDetail> {
        const base = `/v1/recovery-records/${encodeURIComponent(recordId)}/processing`;
        const existing = (await getProcessingDetail(recordId))?.body.data ?? null;
        const uploaded = input.completionEvidence
          ? await addEvidence(recordId, {
              evidenceType: "processing_completion",
              image: input.completionEvidence,
              offline: input.offline,
            })
          : null;
        let detail = (
          await client.requestParsed(base, envelope(ProcessingDetailSchema), {
            method: "PUT",
            body: ProcessingDraftUpdateSchema.parse({
              processing_method: input.method,
              notes: input.notes?.trim() ? input.notes.trim() : null,
              processing_timestamp: input.processedAt ?? null,
              completion_evidence_ids: uploaded
                ? [uploaded.evidence_id]
                : (existing?.completion_evidence_ids ?? []),
            }),
            ...(existing ? { headers: ifMatch(existing.version) } : {}),
          })
        ).data;
        const kept = new Set(
          input.materialEntries.flatMap((entry) => (entry.entryId ? [entry.entryId] : [])),
        );
        for (const entry of detail.material_entries) {
          if (kept.has(entry.entry_id)) continue;
          detail = (
            await client.requestParsed(
              `${base}/material-entries/${encodeURIComponent(entry.entry_id)}`,
              envelope(ProcessingDetailSchema),
              { method: "DELETE", headers: ifMatch(detail.version) },
            )
          ).data;
        }
        for (const entry of input.materialEntries) {
          const body = { material: entry.material.trim(), weight: entry.weight };
          const stored = entry.entryId
            ? detail.material_entries.find((candidate) => candidate.entry_id === entry.entryId)
            : undefined;
          if (stored && sameJson({ material: stored.material, weight: stored.weight }, body)) {
            continue;
          }
          detail = (
            await client.requestParsed(
              stored
                ? `${base}/material-entries/${encodeURIComponent(stored.entry_id)}`
                : `${base}/material-entries`,
              envelope(ProcessingDetailSchema),
              {
                method: stored ? "PATCH" : "POST",
                body: stored
                  ? MaterialEntryUpdateSchema.parse(body)
                  : MaterialEntrySchema.parse(body),
                headers: ifMatch(detail.version),
              },
            )
          ).data;
        }
        return detail;
      },
    },
    reviews: {
      decide,
      async submitDecision(input: ReviewDecisionInput) {
        const user = await me();
        const content = {
          recovery_record_id: input.recordId,
          review_reason_codes: input.reviewReasonCodes.map((code) =>
            ReviewReasonForReviewSchema.parse(code),
          ),
          assigned_reviewer: user.actor_reference,
          evidence_considered: [...input.evidenceConsidered],
          decision: input.decision,
          reason_code: input.reasonCode,
          reviewer_note: input.reviewerNote,
          ...(input.requestedCorrection ? { requested_correction: input.requestedCorrection } : {}),
          previous_review_state: input.previousReviewState,
          previous_record_state: input.previousRecordState,
        };
        return decide({
          ...content,
          decision_timestamp: nowUtc(),
          idempotency: await idempotencyFor(
            IDEMPOTENT_OPERATIONS.recordReviewDecision,
            input.recordId,
            user.user_id,
            toJson(content),
          ),
        });
      },
      async listCases(filters) {
        const parsed = ReviewQueueFiltersSchema.parse(filters);
        return (
          await client.requestParsed(
            `/v1/review-cases${query({
              status: parsed.status,
              flag_code: parsed.flag_code,
              opened_from: parsed.opened_from,
              opened_to: parsed.opened_to,
              facility_id: parsed.facility_id,
              sort: parsed.sort,
              cursor: parsed.cursor,
              limit: parsed.limit,
            })}`,
            envelope(ReviewCasePageSchema),
            { method: "GET" },
          )
        ).data;
      },
      getCase,
      async findCaseForRecord(recordId) {
        const page = (
          await client.requestParsed(
            `/v1/review-cases${query({
              record_id: recordId,
              status: ["open", "awaiting_information", "approved", "rejected"],
              limit: 1,
            })}`,
            envelope(ReviewCasePageSchema),
            { method: "GET" },
          )
        ).data;
        const [summary] = page.items;
        return summary ? getCase(summary.case_id) : null;
      },
    },
    reporting: { summarize: notAvailable, listForReport: notAvailable },
    dataExports: { build: notAvailable },
    safetyContent: {
      list: notAvailable,
      getById: notAvailable,
      createDraft: notAvailable,
      updateDraft: notAvailable,
      approve: notAvailable,
      changeStatus: notAvailable,
    },
    modelAdministration: {
      listRegistry: notAvailable,
      getConfiguration: notAvailable,
      saveConfiguration: notAvailable,
      listFeedback: notAvailable,
      decideFeedback: notAvailable,
    },
    programmeSettings: { get: notAvailable, save: notAvailable },
    synchronization: { synchronize: notAvailable },
    localData: { summary: notAvailable, clear: notAvailable },
  };
};
