import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  EvidenceIdSchema,
  HandoffRequestSchema,
} from "@scraptrace/contracts";

import { HttpClient, ScrapTraceServiceError } from "@/services/http/http-client";
import { createHttpServices } from "@/services/http/http-services";
import { createRecoveryRecordFixture, FIXTURE_IDS } from "@/services/mocks/deterministic-fixtures";
import { localQrPayload } from "@/services/local/record-factory";

const evidenceId = EvidenceIdSchema.parse("0199a111-1111-7111-8111-111111111111");
const timestamp = "2026-09-26T12:30:00.000Z";
const scores = [
  { category: "refrigerators", score: 0.03 },
  { category: "laptops_and_desktop_computers", score: 0.04 },
  { category: "televisions", score: 0.8 },
  { category: "microwaves", score: 0.03 },
  { category: "air_conditioners", score: 0.04 },
  { category: "compressors", score: 0.03 },
  { category: "mixed_scrap", score: 0.03 },
];

const upload = () => ({
  evidence_id: evidenceId,
  image: new File(["image"], "sample.jpg", { type: "image/jpeg" }),
});

afterEach(() => vi.unstubAllGlobals());

describe("vision HTTP adapter", () => {
  it("submits multipart data and parses a classified response", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("evidence_id")).toBe(evidenceId);
      expect(form.get("image")).toBeInstanceOf(File);
      return new Response(
        JSON.stringify({
          outcome: "classified",
          category: "televisions",
          scores,
          confidence: 0.8,
          model_name: "scraptrace-vision-efficientnet-b0",
          model_version: "0.2.0",
          inferred_at: timestamp,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createHttpServices("http://localhost:8000").vision.appraise(upload());
    expect(result.outcome).toBe("classified");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves a low-confidence outcome for manual confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              outcome: "unable_to_classify",
              reason: "low_confidence",
              scores,
              model_name: "scraptrace-vision-efficientnet-b0",
              model_version: "0.2.0",
              inferred_at: timestamp,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const result = await createHttpServices("http://localhost:8000").vision.appraise(upload());
    expect(result).toMatchObject({ outcome: "unable_to_classify", reason: "low_confidence" });
  });

  it("rejects a contract-invalid successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ outcome: "classified", category: "unknown" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(
      createHttpServices("http://localhost:8000").vision.appraise(upload()),
    ).rejects.toThrow();
  });

  it("normalizes a standard service-unavailable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              contract_version: "1.0.0",
              error: {
                code: "DEPENDENCY_UNAVAILABLE",
                message: "The vision model is unavailable.",
                retryable: true,
              },
              meta: { correlation_id: "request-0001", timestamp },
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    await expect(
      createHttpServices("http://localhost:8000").vision.appraise(upload()),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });
});

describe("HTTP foundation", () => {
  const session = {
    actor_id: "0199b001-0001-7001-8001-000000000001",
    role: "collector",
    preferred_language: "en",
    display_label: "Collector",
  } as const;
  const mappedSession = {
    actorId: session.actor_id,
    role: session.role,
    preferredLanguage: session.preferred_language,
    displayLabel: session.display_label,
    developmentOnly: false,
  } as const;
  const success = (data: unknown) => ({
    success: true,
    contract_version: "1.0.0",
    data,
    meta: { correlation_id: "request-0002", timestamp },
  });

  it("restores and creates a secure-cookie session without exposing a token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("X-Request-ID")).toMatch(/^web-/);
      if (path.endsWith("/session")) return Response.json(success(session));
      if (path.endsWith("/sign-in")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          email: "collector@example.test",
          password: "correct horse battery staple",
        });
        return Response.json(success(session));
      }
      return Response.json(success({ signed_out: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const authentication = createHttpServices("https://api.example.test").authentication;

    await expect(authentication.getSession()).resolves.toEqual(mappedSession);
    await expect(
      authentication.signIn({
        email: "collector@example.test",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual(mappedSession);
    await expect(authentication.signOut()).resolves.toBeUndefined();
  });

  it("treats an unauthenticated session lookup as anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(
      createHttpServices("https://api.example.test").authentication.getSession(),
    ).resolves.toBeNull();
  });

  it.each([401, 403, 404, 409, 413, 415, 422, 429, 503])(
    "normalizes an empty %i response into a safe error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status })),
      );
      const request = new HttpClient("https://api.example.test").request("/v1/example", {
        method: "GET",
        suppressSessionExpiry: true,
      });
      await expect(request).rejects.toMatchObject({ status });
    },
  );

  it("passes cancellation to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);
    controller.abort();
    await expect(
      new HttpClient("https://api.example.test").request("/v1/example", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("recovery-record HTTP adapter", () => {
  it("parses owned records and creates a multipart draft", async () => {
    const record = createRecoveryRecordFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (init?.method === "GET") {
        expect(url.searchParams.get("scope")).toBe("own");
        return Response.json([record]);
      }
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toMatch(/^create-draft:/);
      const form = init?.body as FormData;
      expect(JSON.parse(String(form.get("metadata")))).toMatchObject({
        category: "televisions",
        condition: "damaged",
      });
      expect((form.get("image") as File).name).toBe("evidence-upload");
      return Response.json(record);
    });
    vi.stubGlobal("fetch", fetchMock);
    const records = createHttpServices("https://api.example.test").recoveryRecords;

    await expect(records.listOwn()).resolves.toEqual([record]);
    await expect(
      records.createDraft({
        category: "televisions",
        language: "en",
        condition: "damaged",
        itemCount: 1,
        areaLabel: "Greater Accra",
        confirmationSource: "manual_selection",
        image: new File(["image"], "private-device-name.jpg", { type: "image/jpeg" }),
        offline: false,
      }),
    ).resolves.toEqual(record);
  });

  it("submits one canonical record with an idempotency key", async () => {
    const record = createRecoveryRecordFixture();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        `submit-record:${record.record_id}`,
      );
      return Response.json({ outcome: "submitted", record, replayed: false });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await createHttpServices("https://api.example.test").recoveryRecords.submit(
      record.record_id,
    );
    expect(result).toMatchObject({ outcome: "submitted", record: { record_id: record.record_id } });
  });

  it("parses evidence and events and retrieves protected image content", async () => {
    class TestFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.result = "data:image/jpeg;base64,aW1hZ2U=";
        this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", TestFileReader);
    const record = createRecoveryRecordFixture();
    const evidence = {
      evidence_schema_version: CONTRACT_SCHEMA_VERSION,
      evidence_id: evidenceId,
      recovery_record_id: record.record_id,
      evidence_type: "original_item_photo",
      storage_reference: {
        storage_provider: "object-store",
        object_key: `records/${record.record_id}/${evidenceId}`,
      },
      mime_type: "image/jpeg",
      file_size_bytes: 5,
      content_digest: `sha256:${"a".repeat(64)}`,
      provenance: {
        capture_source: "in_app_camera",
        captured_by: record.collector,
        device_instance_id: record.sync.device_instance_id,
        captured_at: timestamp,
        application_version: "1.0.0",
        connectivity: "online",
      },
      validation_status: "accepted",
    } as const;
    const event = {
      event_schema_version: EVENT_SCHEMA_VERSION,
      event_id: "0199a888-8888-7888-8888-888888888888",
      recovery_record_id: record.record_id,
      event_type: "submit_record",
      actor: record.collector,
      actor_role: "collector",
      occurred_at: timestamp,
      previous_state: "draft",
      resulting_state: "submitted",
    } as const;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      expect(init?.credentials).toBe("include");
      if (path.endsWith("/events")) return Response.json([event]);
      if (path.endsWith("/evidence")) return Response.json([evidence]);
      expect(new Headers(init?.headers).get("Accept")).toBe("image/*");
      return new Response("image", { headers: { "Content-Type": "image/jpeg" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const records = createHttpServices("https://api.example.test").recoveryRecords;

    await expect(records.listEvents(record.record_id)).resolves.toEqual([event]);
    await expect(records.listEvidence(record.record_id)).resolves.toEqual([evidence]);
    await expect(records.getEvidenceImage(evidenceId)).resolves.toMatch(
      /^data:image\/jpeg;base64,/,
    );
  });

  it("returns no evidence image for a missing protected object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(
      createHttpServices("https://api.example.test").recoveryRecords.getEvidenceImage(evidenceId),
    ).resolves.toBeNull();
  });

  it("rejects contract-invalid evidence and event responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ evidence_id: evidenceId }])),
    );
    const records = createHttpServices("https://api.example.test").recoveryRecords;
    await expect(records.listEvidence(createRecoveryRecordFixture().record_id)).rejects.toThrow();
    await expect(records.listEvents(createRecoveryRecordFixture().record_id)).rejects.toThrow();
  });
});

describe("handoff HTTP adapter", () => {
  it("looks up a scanned backend QR payload and parses the record", async () => {
    const record = createRecoveryRecordFixture();
    const code = `SCRAPTRACE:1.0.0:${record.record_id}:${localQrPayload(record).lookup_token}`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input.toString()).pathname).toBe("/v1/handoff-lookups");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ code });
      return Response.json({ outcome: "ready", record });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpServices("https://api.example.test").recoveryRecords.lookupForHandoff(code),
    ).resolves.toEqual({ outcome: "ready", record });
  });

  it("maps the transport receipt timestamp for an already received lookup", async () => {
    const record = createRecoveryRecordFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ outcome: "already_received", record, received_at: timestamp }),
      ),
    );

    await expect(
      createHttpServices("https://api.example.test").recoveryRecords.lookupForHandoff(
        record.human_reference,
      ),
    ).resolves.toEqual({ outcome: "already_received", record, receivedAt: timestamp });
  });

  it("uploads receipt evidence as multipart data with a stable idempotency key", async () => {
    const record = createRecoveryRecordFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input.toString()).pathname).toBe(
        `/v1/recovery-records/${record.record_id}/handoffs`,
      );
      expect(init?.body).toBeInstanceOf(FormData);
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        `record-handoff:${record.record_id}`,
      );
      const form = init?.body as FormData;
      expect(JSON.parse(String(form.get("metadata")))).toMatchObject({
        confirmed_category: "televisions",
        measured_weight: { value: 20, unit: "kg" },
        receiving_location_id: FIXTURE_IDS.location,
      });
      expect(form.get("handoff_photo")).toBeInstanceOf(File);
      expect(form.get("weight_photo")).toBeInstanceOf(File);
      return Response.json({
        outcome: "accepted",
        recovery_record_id: record.record_id,
        received_at: timestamp,
        replayed: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpServices("https://api.example.test").handoffs.confirmReceipt({
        recordId: record.record_id,
        confirmedCategory: "televisions",
        confirmedCondition: "damaged",
        measuredWeight: { value: 20, unit: "kg" },
        finalPriceAmount: 120,
        finalPriceCurrency: "GHS",
        receivingLocationId: FIXTURE_IDS.location,
        evidence: {
          handoffPhoto: new File(["handoff"], "handoff.jpg", { type: "image/jpeg" }),
          weightPhoto: new File(["weight"], "scale.jpg", { type: "image/jpeg" }),
          scannedPayload: "opaque scanned value",
          notes: "Seal intact",
        },
        offline: false,
      }),
    ).resolves.toMatchObject({ outcome: "accepted", recovery_record_id: record.record_id });
  });

  it("validates and sends a contract-shaped handoff request", async () => {
    const record = createRecoveryRecordFixture();
    const request = HandoffRequestSchema.parse({
      recovery_record_id: record.record_id,
      lookup_token: localQrPayload(record).lookup_token,
      collector_reference: record.collector,
      recycler_reference: { actor_id: FIXTURE_IDS.recycler },
      receiving_location_id: FIXTURE_IDS.location,
      handoff_time: timestamp,
      confirmed_category: "televisions",
      confirmed_condition: "damaged",
      measured_weight: { value: 20, unit: "kg" },
      final_price: { amount: 120, currency: "GHS" },
      evidence_ids: [evidenceId, "0199a222-2222-7222-8222-222222222223"],
      idempotency: {
        idempotency_key: "record-handoff:test-request",
        request_digest: `sha256:${"b".repeat(64)}`,
        scope: {
          actor_id: FIXTURE_IDS.recycler,
          operation: "record_handoff",
          resource_id: record.record_id,
        },
      },
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(request);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        request.idempotency.idempotency_key,
      );
      return Response.json({
        outcome: "accepted",
        recovery_record_id: record.record_id,
        received_at: timestamp,
        replayed: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpServices("https://api.example.test").handoffs.record(request),
    ).resolves.toMatchObject({ outcome: "accepted" });
  });
});

describe("processing and review HTTP adapters", () => {
  it("uploads processing evidence and contract metadata", async () => {
    const record = createRecoveryRecordFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input.toString()).pathname).toBe(
        `/v1/recovery-records/${record.record_id}/processing`,
      );
      expect(init?.body).toBeInstanceOf(FormData);
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        `record-processing:${record.record_id}`,
      );
      const form = init?.body as FormData;
      expect(JSON.parse(String(form.get("metadata")))).toEqual({
        processing_method: "material_recovery",
        material_entries: [{ material: "Copper", weight: { value: 4, unit: "kg" } }],
        processing_timestamp: timestamp,
        notes: "Materials separated",
        offline: false,
      });
      expect(form.get("completion_evidence")).toBeInstanceOf(File);
      return Response.json({
        outcome: "processing_recorded",
        recovery_record_id: record.record_id,
        server_revision: 4,
        replayed: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpServices("https://api.example.test").processing.submitProcessing({
        recordId: record.record_id,
        method: "material_recovery",
        materialEntries: [{ material: " Copper ", weight: { value: 4, unit: "kg" } }],
        processedAt: timestamp,
        notes: "Materials separated",
        completionEvidence: new File(["complete"], "private.jpg", { type: "image/jpeg" }),
        offline: false,
      }),
    ).resolves.toMatchObject({ outcome: "processing_recorded", server_revision: 4 });
  });

  it("loads the review queue and submits an explicit reviewer decision", async () => {
    const record = createRecoveryRecordFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (init?.method === "GET") {
        expect(url.pathname).toBe("/v1/reviews");
        expect(url.searchParams.get("status")).toBe("open");
        return Response.json([record]);
      }
      expect(url.pathname).toBe(`/v1/recovery-records/${record.record_id}/review-decisions`);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        `review-approve:${record.record_id}`,
      );
      expect(JSON.parse(String(init?.body))).toEqual({
        decision: "approve",
        reason_code: "EVIDENCE_SUFFICIENT",
        reviewer_note: "Evidence is internally consistent.",
      });
      return Response.json({
        recovery_record_id: record.record_id,
        previous_review_state: "open",
        resulting_review_state: "approved",
        previous_record_state: "under_review",
        resulting_record_state: "approved_and_completed",
        decision_timestamp: timestamp,
        replayed: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const services = createHttpServices("https://api.example.test");

    await expect(services.reviews.listQueue()).resolves.toEqual([record]);
    await expect(
      services.reviews.submitDecision({
        recordId: record.record_id,
        decision: "approve",
        reasonCode: "EVIDENCE_SUFFICIENT",
        reviewerNote: "Evidence is internally consistent.",
      }),
    ).resolves.toMatchObject({
      recovery_record_id: record.record_id,
      resulting_review_state: "approved",
    });
  });

  it("requires correction instructions before sending that decision", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() =>
      createHttpServices("https://api.example.test").reviews.submitDecision({
        recordId: createRecoveryRecordFixture().record_id,
        decision: "request_correction",
        reasonCode: "ADDITIONAL_EVIDENCE_REQUIRED",
        reviewerNote: "The weight image is unreadable.",
      }),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects contract-invalid processing and review responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ outcome: "done" })),
    );
    const record = createRecoveryRecordFixture();
    const services = createHttpServices("https://api.example.test");
    await expect(
      services.processing.submitProcessing({
        recordId: record.record_id,
        method: "safe_storage",
        materialEntries: [],
        processedAt: timestamp,
        notes: "Secured for later treatment",
        completionEvidence: new File(["complete"], "complete.jpg", { type: "image/jpeg" }),
        offline: false,
      }),
    ).rejects.toThrow();
    await expect(
      services.reviews.submitDecision({
        recordId: record.record_id,
        decision: "reject",
        reasonCode: "EVIDENCE_INSUFFICIENT",
        reviewerNote: "Evidence cannot support the claim.",
      }),
    ).rejects.toThrow();
  });
});
