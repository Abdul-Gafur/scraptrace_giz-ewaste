import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  ActorReferenceSchema,
  EVENT_SCHEMA_VERSION,
  EvidenceIdSchema,
  HandoffRequestSchema,
  ManualTransferCodeSchema,
  ProcessingRequestSchema,
  ProgrammeReviewRequestSchema,
  RecoveryRecordDraftCreateSchema,
  RecoveryRecordSchema,
  type RecoveryRecord,
} from "@scraptrace/contracts";

import { sha256Bytes } from "@/services/domain/digest";
import {
  HttpClient,
  SESSION_EXPIRED_EVENT,
  ScrapTraceServiceError,
} from "@/services/http/http-client";
import { createHttpServices } from "@/services/http/http-services";
import manifest from "@/services/http/consumed-operations.json";
import { createRecoveryRecordFixture, FIXTURE_IDS } from "@/services/mocks/deterministic-fixtures";

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

/**
 * Adapter tests against the real Phase 1 API shapes. Each request is routed by method and path,
 * so a request to a route the API does not have fails the test.
 */
const API = "https://api.example.test";
const IDS = {
  programme: "0199b010-0010-7010-8010-000000000010",
  facility: "0199b011-0011-7011-8011-000000000011",
  location: "0199b031-0031-7031-8031-000000000031",
  collector: "0199b001-0001-7001-8001-000000000001",
  recycler: "0199b002-0002-7002-8002-000000000002",
  reviewer: "0199b003-0003-7003-8003-000000000003",
  handoffPhoto: "0199a901-0000-7000-8000-000000000001",
  weightPhoto: "0199a902-0000-7000-8000-000000000002",
  completion: "0199a903-0000-7000-8000-000000000003",
  caseId: "0199a904-0000-7000-8000-000000000004",
  entry: "0199a905-0000-7000-8000-000000000005",
} as const;

const success = (data: unknown) => ({
  success: true,
  contract_version: "1.0.0",
  data,
  meta: { correlation_id: "request-0002", timestamp },
});
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(success(data)), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const errorResponse = (status: number, code: string, message = "Refused.") =>
  new Response(
    JSON.stringify({
      success: false,
      contract_version: "1.0.0",
      error: { code, message, retryable: false },
      meta: { correlation_id: "request-0003", timestamp },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );

const user = (role: "collector" | "recycler" | "programme_reviewer") => {
  const id =
    role === "collector" ? IDS.collector : role === "recycler" ? IDS.recycler : IDS.reviewer;
  return {
    user_id: id,
    username: `${role}.demo`,
    display_name: `Demonstration ${role}`,
    role,
    permissions: [],
    programme_ids: [IDS.programme],
    facility_ids: role === "recycler" ? [IDS.facility] : [],
    receiving_location_ids: role === "recycler" ? [IDS.location] : [],
    preferred_language: "en",
    actor_reference: {
      actor_id: id,
      programme_id: IDS.programme,
      ...(role === "recycler" ? { facility_id: IDS.facility } : {}),
    },
  };
};

/** A record as the API returns it: no QR credential inside the resource. */
const serverRecord = (overrides: Partial<Record<string, unknown>> = {}): RecoveryRecord => {
  const fixture = Object.fromEntries(
    Object.entries(createRecoveryRecordFixture()).filter(([field]) => field !== "qr_payload"),
  ) as Omit<RecoveryRecord, "qr_payload">;
  return RecoveryRecordSchema.parse({
    ...fixture,
    collector: { actor_id: IDS.collector, programme_id: IDS.programme },
    category_confirmation: {
      ...fixture.category_confirmation,
      confirmed_by: { actor_id: IDS.collector, programme_id: IDS.programme },
    },
    sync: {
      sync_state: "synchronized",
      device_instance_id: FIXTURE_IDS.device,
      local_revision: 3,
      server_revision: 3,
    },
    revision: 3,
    ...overrides,
  });
};

const evidenceMetadata = (id: string, type: string) => ({
  evidence_schema_version: "1.0.0",
  evidence_id: id,
  recovery_record_id: FIXTURE_IDS.record,
  evidence_type: type,
  mime_type: "image/jpeg",
  file_size_bytes: 12,
  content_digest: `sha256:${"b".repeat(64)}`,
  provenance: {
    capture_source: "recycler_camera",
    captured_by: { actor_id: IDS.recycler },
    device_instance_id: FIXTURE_IDS.device,
    captured_at: timestamp,
    server_received_at: timestamp,
    application_version: "0.1.0",
    connectivity: "online",
  },
  validation_status: "accepted",
  storage_transform: "reencoded_without_metadata",
});

type Handler = (request: {
  url: URL;
  init: RequestInit;
  headers: Headers;
  body: unknown;
}) => Response | Promise<Response>;

/**
 * Every operation these tests exercise. `consumed-operations.json` must list exactly these, and
 * the API test suite checks that list against the generated OpenAPI document, so a route the
 * adapter calls but the API does not publish fails one side or the other.
 */
const exercised = new Set<string>();
const templates = manifest.operations.map((operation) => ({
  key: `${operation.method} ${operation.path}`,
  pattern: new RegExp(`^${operation.method} ${operation.path.replace(/\{[a-z_]+\}/g, "[^/]+")}$`),
}));
const operationFor = (key: string) => templates.find((template) => template.pattern.test(key))?.key;

afterAll(() => {
  const listed = new Set(templates.map((template) => template.key));
  expect([...listed].filter((key) => !exercised.has(key))).toEqual([]);
});

/** Routes `METHOD /path` to a handler; unrouted or unlisted requests fail the test. */
const route = (routes: Record<string, Handler>) => {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input.toString());
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    calls.push(key);
    const operation = operationFor(key);
    expect(operation, `${key} is not in consumed-operations.json`).toBeDefined();
    if (operation) exercised.add(operation);
    expect(init.credentials).toBe("include");
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const body =
      typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : (init.body ?? null);
    return handler({ url, init, headers: new Headers(init.headers), body });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
};

describe("authentication adapter", () => {
  it("signs in with a username and keeps the credential out of JavaScript", async () => {
    const { calls } = route({
      "POST /v1/auth/sessions": ({ body }) => {
        expect(body).toEqual({ username: "collector.demo", password: "demonstration" });
        return json({ expires_at: timestamp, user: user("collector") }, 201);
      },
      "GET /v1/auth/me": () => json(user("collector")),
      "DELETE /v1/auth/sessions/current": () => new Response(null, { status: 204 }),
    });
    const authentication = createHttpServices(API).authentication;
    const session = await authentication.signIn({
      username: " Collector.Demo ",
      password: "demonstration",
    });
    expect(session).toMatchObject({
      actorId: IDS.collector,
      role: "collector",
      developmentOnly: false,
      actorReference: { actor_id: IDS.collector, programme_id: IDS.programme },
    });
    expect(JSON.stringify(session)).not.toMatch(/token|password/i);
    await expect(authentication.getSession()).resolves.toMatchObject({ actorId: IDS.collector });
    await expect(authentication.signOut()).resolves.toBeUndefined();
    expect(calls).toEqual(["POST /v1/auth/sessions", "DELETE /v1/auth/sessions/current"]);
  });

  it("restores the session from the cookie and treats 401 as anonymous", async () => {
    route({ "GET /v1/auth/me": () => json(user("recycler")) });
    await expect(createHttpServices(API).authentication.getSession()).resolves.toMatchObject({
      role: "recycler",
      receivingLocationIds: [IDS.location],
    });
    route({ "GET /v1/auth/me": () => errorResponse(401, "AUTHENTICATION_REQUIRED") });
    await expect(createHttpServices(API).authentication.getSession()).resolves.toBeNull();
  });

  it("rejects a sign-in response that carries a bearer credential", async () => {
    route({
      "POST /v1/auth/sessions": () =>
        json({ expires_at: timestamp, user: user("collector"), access_token: "secret" }, 201),
    });
    await expect(
      createHttpServices(API).authentication.signIn({ username: "a", password: "b" }),
    ).rejects.toThrow();
  });

  it("lists demonstration usernames, or none when discovery is disabled", async () => {
    route({
      "GET /v1/auth/demo-accounts": () =>
        json([{ username: "collector.demo", display_name: "Collector", role: "collector" }]),
    });
    await expect(createHttpServices(API).authentication.listDemoAccounts()).resolves.toHaveLength(
      1,
    );
    route({ "GET /v1/auth/demo-accounts": () => errorResponse(404, "RESOURCE_NOT_FOUND") });
    await expect(createHttpServices(API).authentication.listDemoAccounts()).resolves.toEqual([]);
  });

  it("announces an expired session on a 401 from any other call", async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    route({ "GET /v1/recovery-records": () => errorResponse(401, "AUTHENTICATION_REQUIRED") });
    await expect(createHttpServices(API).recoveryRecords.listPage({})).rejects.toMatchObject({
      status: 401,
    });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});

describe("reference data adapter", () => {
  it("reads programme settings and the programme and facility directories", async () => {
    const location = {
      location_id: IDS.location,
      facility_id: IDS.facility,
      name: "Accra Central Collection Centre",
      facility_type: "collection_centre",
      verification_status: "programme_verified",
      verification_date: "2026-08-14",
      accepted_categories: ["televisions"],
    };
    const other = { ...location, location_id: IDS.entry, name: "Not assigned" };
    route({
      "GET /v1/auth/me": () => json(user("recycler")),
      [`GET /v1/programmes/${IDS.programme}`]: () =>
        json({
          programme_id: IDS.programme,
          name: "Demo",
          currency: "GHS",
          country_code: "GH",
          weight_discrepancy_threshold_percentage: 15,
        }),
      [`GET /v1/programmes/${IDS.programme}/receiving-locations`]: () => json([location, other]),
      [`GET /v1/facilities/${IDS.facility}/receiving-locations`]: () => json([location, other]),
    });
    const reference = createHttpServices(API).reference;
    await expect(reference.getProgramme()).resolves.toMatchObject({ currency: "GHS" });
    await expect(reference.listDestinations()).resolves.toHaveLength(2);
    // Only the locations this recycler is assigned to are offered for a handoff.
    await expect(reference.listReceivingLocations()).resolves.toEqual([location]);
  });
});

describe("recovery-record adapter", () => {
  it("requests server-filtered pages and follows the server cursor", async () => {
    const record = serverRecord();
    route({
      "GET /v1/recovery-records": ({ url }) => {
        expect(url.searchParams.getAll("state")).toEqual(["draft"]);
        expect(url.searchParams.get("limit")).toBe("25");
        return json({ items: [record], pagination: { next_cursor: "next", has_more: true } });
      },
    });
    const page = await createHttpServices(API).recoveryRecords.listPage({
      limit: 25,
      state: ["draft"],
    });
    expect(page.items).toEqual([record]);
    expect(page.pagination.next_cursor).toBe("next");
  });

  it("rejects a bare array where the contract requires a page", async () => {
    route({ "GET /v1/recovery-records": () => json([serverRecord()]) });
    await expect(createHttpServices(API).recoveryRecords.listPage({})).rejects.toThrow();
  });

  it("creates a draft as multipart record and original_image with a stable key", async () => {
    const created = serverRecord();
    const keys: string[] = [];
    route({
      "GET /v1/auth/me": () => json(user("collector")),
      [`GET /v1/programmes/${IDS.programme}`]: () =>
        json({
          programme_id: IDS.programme,
          name: "Demo",
          currency: "GHS",
          country_code: "GH",
          weight_discrepancy_threshold_percentage: 15,
        }),
      "POST /v1/recovery-records": ({ init, headers }) => {
        expect(headers.has("Content-Type")).toBe(false);
        keys.push(headers.get("Idempotency-Key") ?? "");
        const form = init.body as FormData;
        const metadata = RecoveryRecordDraftCreateSchema.parse(
          JSON.parse(String(form.get("record"))),
        );
        expect(metadata.category_confirmation.confirmed_by).toEqual({
          actor_id: IDS.collector,
          programme_id: IDS.programme,
        });
        expect(metadata.approximate_area.country_code).toBe("GH");
        expect(metadata).not.toHaveProperty("human_reference");
        expect((form.get("original_image") as File).name).toBe("original-image");
        return json(created, 201);
      },
    });
    const image = new File(["image"], "private-device-name.jpg", { type: "image/jpeg" });
    const input = {
      category: "televisions" as const,
      language: "en" as const,
      condition: "damaged" as const,
      itemCount: 1,
      areaLabel: "Greater Accra",
      confirmationSource: "manual_selection" as const,
      image,
      offline: false,
    };
    const records = createHttpServices(API).recoveryRecords;
    await expect(records.createDraft(input)).resolves.toEqual(created);
    await records.createDraft(input);
    // A retried creation repeats exactly the same request, so the API replays it.
    expect(keys[0]).toMatch(/^create_record:/);
    expect(keys[1]).toBe(keys[0]);
  });

  it("edits a draft with If-Match and confirms a changed category separately", async () => {
    const current = serverRecord();
    route({
      "GET /v1/auth/me": () => json(user("collector")),
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}`]: () => json(current),
      [`PATCH /v1/recovery-records/${FIXTURE_IDS.record}`]: ({ headers, body }) => {
        expect(headers.get("If-Match")).toBe('"3"');
        expect(body).toEqual({ condition: "working" });
        return json(serverRecord({ condition: "working", revision: 4 }));
      },
      [`POST /v1/recovery-records/${FIXTURE_IDS.record}/category-confirmations`]: ({
        headers,
        body,
      }) => {
        expect(headers.get("If-Match")).toBe('"4"');
        expect(body).toMatchObject({
          confirmed_category: "microwaves",
          source: "manual_selection",
        });
        return json(
          serverRecord({
            category: "microwaves",
            condition: "working",
            revision: 5,
            category_confirmation: {
              confirmed_category: "microwaves",
              confirmed_by: { actor_id: IDS.collector, programme_id: IDS.programme },
              confirmed_at: timestamp,
              source: "manual_selection",
            },
          }),
        );
      },
    });
    const updated = await createHttpServices(API).recoveryRecords.updateDraft(FIXTURE_IDS.record, {
      category: "microwaves",
      language: "en",
      condition: "working",
      itemCount: 1,
      areaLabel: "Demonstration area",
      confirmationSource: "manual_selection",
      offline: false,
      baseRevision: 3,
    });
    expect(updated.revision).toBe(5);
  });

  it("parses the authoritative submission result", async () => {
    const record = serverRecord({ business_state: "awaiting_handoff", handoff_state: "awaiting" });
    route({
      [`POST /v1/recovery-records/${FIXTURE_IDS.record}/submissions`]: () =>
        json({
          outcome: "duplicate_image",
          record,
          replayed: false,
          flag_codes: ["DUPLICATE_EVIDENCE_DIGEST"],
        }),
    });
    await expect(
      createHttpServices(API).recoveryRecords.submit(FIXTURE_IDS.record),
    ).resolves.toMatchObject({
      outcome: "duplicate_image",
      flagCodes: ["DUPLICATE_EVIDENCE_DIGEST"],
    });
  });

  it("reads and reissues the owner's credentials", async () => {
    const credentials = (token: string, code: string) => ({
      record_id: FIXTURE_IDS.record,
      status: "active",
      qr_payload: { contract_version: "1.0.0", record_id: FIXTURE_IDS.record, lookup_token: token },
      manual_transfer_code: code,
      issued_at: timestamp,
      activated_at: timestamp,
      expires_at: "2026-10-26T12:30:00.000Z",
    });
    route({
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}/qr-credentials`]: () =>
        json(credentials("a".repeat(43), "7K3Q-M9XD-2HVT")),
      [`POST /v1/recovery-records/${FIXTURE_IDS.record}/qr-token-rotations`]: () =>
        json(credentials("b".repeat(43), "0000-1111-2222"), 201),
    });
    const records = createHttpServices(API).recoveryRecords;
    await expect(records.getQrCredentials(FIXTURE_IDS.record)).resolves.toMatchObject({
      manual_transfer_code: "7K3Q-M9XD-2HVT",
    });
    await expect(records.reissueQrCredentials(FIXTURE_IDS.record)).resolves.toMatchObject({
      manual_transfer_code: "0000-1111-2222",
    });
  });

  it("parses the timeline and public evidence metadata", async () => {
    route({
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}/events`]: () =>
        json([
          {
            event_schema_version: EVENT_SCHEMA_VERSION,
            event_id: "0199a906-0000-7000-8000-000000000006",
            recovery_record_id: FIXTURE_IDS.record,
            event_type: "draft_created",
            actor: { actor_id: IDS.collector },
            actor_role: "collector",
            occurred_at: timestamp,
            previous_state: "draft",
            resulting_state: "draft",
            evidence_id: FIXTURE_IDS.evidence,
          },
        ]),
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}/evidence`]: () =>
        json([evidenceMetadata(IDS.handoffPhoto, "handoff_photo")]),
    });
    const records = createHttpServices(API).recoveryRecords;
    await expect(records.listEvents(FIXTURE_IDS.record)).resolves.toHaveLength(1);
    await expect(records.listEvidence(FIXTURE_IDS.record)).resolves.toHaveLength(1);
  });

  it("refuses evidence metadata that exposes a storage path", async () => {
    route({
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}/evidence`]: () =>
        json([
          {
            ...evidenceMetadata(IDS.handoffPhoto, "handoff_photo"),
            storage_reference: { storage_provider: "local", object_key: "evidence/x/y" },
          },
        ]),
    });
    await expect(
      createHttpServices(API).recoveryRecords.listEvidence(FIXTURE_IDS.record),
    ).rejects.toThrow();
  });

  it("returns protected evidence only when its digest matches", async () => {
    const bytes = new TextEncoder().encode("image-bytes");
    const digest = await sha256Bytes(bytes);
    const delivery = (header: string) =>
      new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store",
          "X-Content-Digest": header,
        },
      });
    route({ [`GET /v1/evidence/${FIXTURE_IDS.evidence}/content`]: () => delivery(digest) });
    await expect(
      createHttpServices(API).recoveryRecords.getEvidenceImage(FIXTURE_IDS.evidence),
    ).resolves.toMatch(/^data:image\/jpeg;base64,/);
    route({
      [`GET /v1/evidence/${FIXTURE_IDS.evidence}/content`]: () =>
        delivery(`sha256:${"0".repeat(64)}`),
    });
    await expect(
      createHttpServices(API).recoveryRecords.getEvidenceImage(FIXTURE_IDS.evidence),
    ).rejects.toMatchObject({ envelope: { error: { code: "INTEGRITY_FAILURE" } } });
  });
});

describe("handoff adapter", () => {
  const preview = {
    record_id: FIXTURE_IDS.record,
    human_reference: "ST-DEMO0001",
    record_kind: "item",
    category: "televisions",
    condition: "damaged",
    approximate_area: { label: "Demonstration area", country_code: "GH" },
    captured_at: timestamp,
    collector: { actor_id: IDS.collector, programme_id: IDS.programme },
    original_image_evidence_id: FIXTURE_IDS.evidence,
    business_state: "awaiting_handoff",
    handoff_state: "awaiting",
  };

  it("looks up a typed manual code and relays it without asking for the QR token", async () => {
    route({
      "POST /v1/handoff-lookups": ({ body }) => {
        expect(body).toEqual({ manual_transfer_code: "7K3Q-M9XD-2HVT" });
        return json({ outcome: "ready", record: preview });
      },
    });
    await expect(
      createHttpServices(API).recoveryRecords.lookupForHandoff(" 7k3q m9xd 2hvt "),
    ).resolves.toEqual({
      outcome: "ready",
      record: preview,
      credential: { kind: "manual_transfer_code", code: "7K3Q-M9XD-2HVT" },
    });
  });

  it("looks up scanned QR text and relays the scanned token", async () => {
    const token = "c".repeat(43);
    const text = `SCRAPTRACE:1.0.0:${FIXTURE_IDS.record}:${token}`;
    route({
      "POST /v1/handoff-lookups": ({ body }) => {
        expect(body).toEqual({ qr_text: text });
        return json({ outcome: "ready", record: preview });
      },
    });
    await expect(
      createHttpServices(API).recoveryRecords.lookupForHandoff(text),
    ).resolves.toMatchObject({ credential: { kind: "qr_token", lookupToken: token } });
  });

  it("refuses a lookup result that carries a credential", async () => {
    route({
      "POST /v1/handoff-lookups": () =>
        json({ outcome: "ready", record: preview, lookup_token: "d".repeat(43) }),
    });
    await expect(
      createHttpServices(API).recoveryRecords.lookupForHandoff("7K3Q-M9XD-2HVT"),
    ).rejects.toThrow();
  });

  it("maps generic failures to safe lookup outcomes", async () => {
    route({ "POST /v1/handoff-lookups": () => errorResponse(404, "RESOURCE_NOT_FOUND") });
    const records = createHttpServices(API).recoveryRecords;
    await expect(records.lookupForHandoff("7K3Q-M9XD-2HVT")).resolves.toEqual({
      outcome: "not_found",
    });
    route({
      "POST /v1/handoff-lookups": () => errorResponse(422, "UNSUPPORTED_CONTRACT_VERSION"),
    });
    await expect(
      records.lookupForHandoff(`SCRAPTRACE:9.9.9:${FIXTURE_IDS.record}:${"e".repeat(43)}`),
    ).resolves.toEqual({ outcome: "unsupported_contract_version" });
    const { fetchMock } = route({});
    await expect(records.lookupForHandoff("ST-DEMO0001")).resolves.toEqual({
      outcome: "not_found",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads both photographs, then records the handoff with the presented credential", async () => {
    const { calls } = route({
      "GET /v1/auth/me": () => json(user("recycler")),
      [`POST /v1/recovery-records/${FIXTURE_IDS.record}/evidence`]: ({ init }) => {
        const form = init.body as FormData;
        const type = String(form.get("evidence_type"));
        expect(["handoff_photo", "weight_measurement"]).toContain(type);
        expect(form.get("capture_source")).toBe("recycler_camera");
        return json(
          evidenceMetadata(type === "handoff_photo" ? IDS.handoffPhoto : IDS.weightPhoto, type),
          201,
        );
      },
      "POST /v1/handoffs": ({ body }) => {
        const request = HandoffRequestSchema.parse(body);
        expect(request.manual_transfer_code).toBe("7K3Q-M9XD-2HVT");
        expect(request).not.toHaveProperty("lookup_token");
        expect(request.evidence_ids.sort()).toEqual([IDS.handoffPhoto, IDS.weightPhoto].sort());
        expect(request.idempotency.scope).toEqual({
          actor_id: IDS.recycler,
          operation: "record_handoff",
          resource_id: FIXTURE_IDS.record,
        });
        expect(request.notes).toBe("Door seal cracked.");
        return json({
          outcome: "duplicate_scan",
          original_received_at: timestamp,
          original_logical_result: "accepted",
        });
      },
    });
    const result = await createHttpServices(API).handoffs.confirmReceipt({
      recordId: FIXTURE_IDS.record,
      collectorReference: ActorReferenceSchema.parse({
        actor_id: IDS.collector,
        programme_id: IDS.programme,
      }),
      credential: {
        kind: "manual_transfer_code",
        code: ManualTransferCodeSchema.parse("7K3Q-M9XD-2HVT"),
      },
      confirmedCategory: "televisions",
      confirmedCondition: "damaged",
      measuredWeight: { value: 12, unit: "kg" },
      finalPriceAmount: 10,
      finalPriceCurrency: "GHS",
      receivingLocationId: IDS.location,
      evidence: {
        handoffPhoto: new File(["h"], "h.jpg", { type: "image/jpeg" }),
        weightPhoto: new File(["w"], "w.jpg", { type: "image/jpeg" }),
      },
      notes: "Door seal cracked.",
      offline: false,
    });
    expect(result.outcome).toBe("duplicate_scan");
    expect(calls.at(-1)).toBe("POST /v1/handoffs");
  });
});

describe("processing adapter", () => {
  const detail = (version: number, entries: unknown[] = []) => ({
    record_id: FIXTURE_IDS.record,
    status: "draft",
    processing_method: "material_recovery",
    completion_evidence_ids: [IDS.completion],
    material_entries: entries,
    total_recovered_weight_kg: entries.length > 0 ? 2 : 0,
    version,
    updated_at: timestamp,
  });

  it("edits and removes saved material entries by their server identifiers", async () => {
    const base = `/v1/recovery-records/${FIXTURE_IDS.record}/processing`;
    const copper = { entry_id: IDS.entry, material: "Copper", weight: { value: 2, unit: "kg" } };
    const steel = {
      entry_id: IDS.caseId,
      material: "Steel",
      weight: { value: 5, unit: "kg" },
    };
    route({
      [`GET ${base}`]: () => json(detail(5, [copper, steel])),
      [`PUT ${base}`]: () => json(detail(6, [copper, steel])),
      [`DELETE ${base}/material-entries/${IDS.caseId}`]: ({ headers }) => {
        expect(headers.get("If-Match")).toBe('"6"');
        return json(detail(7, [copper]));
      },
      [`PATCH ${base}/material-entries/${IDS.entry}`]: ({ headers, body }) => {
        expect(headers.get("If-Match")).toBe('"7"');
        expect(body).toEqual({ material: "Copper", weight: { value: 2.5, unit: "kg" } });
        return json(detail(8, [{ ...copper, weight: { value: 2.5, unit: "kg" } }]));
      },
    });
    const saved = await createHttpServices(API).processing.saveDraft(FIXTURE_IDS.record, {
      method: "material_recovery",
      materialEntries: [
        { entryId: IDS.entry, material: "Copper", weight: { value: 2.5, unit: "kg" } },
      ],
      offline: false,
    });
    expect(saved.version).toBe(8);
  });

  it("reads the server queue and a missing draft", async () => {
    route({
      "GET /v1/processing-queue": () =>
        json({ items: [], pagination: { next_cursor: null, has_more: false } }),
      [`GET /v1/recovery-records/${FIXTURE_IDS.record}/processing`]: () =>
        errorResponse(404, "RESOURCE_NOT_FOUND"),
    });
    const processing = createHttpServices(API).processing;
    await expect(processing.listQueue({})).resolves.toMatchObject({ items: [] });
    await expect(processing.getDraft(FIXTURE_IDS.record)).resolves.toBeNull();
  });

  it("saves the draft and adds a material entry against the current version", async () => {
    const base = `/v1/recovery-records/${FIXTURE_IDS.record}/processing`;
    route({
      [`GET ${base}`]: () => json(detail(2)),
      [`PUT ${base}`]: ({ headers, body }) => {
        expect(headers.get("If-Match")).toBe('"2"');
        expect(body).toMatchObject({ processing_method: "material_recovery", notes: "Separated." });
        return json(detail(3));
      },
      [`POST ${base}/material-entries`]: ({ headers, body }) => {
        expect(headers.get("If-Match")).toBe('"3"');
        expect(body).toEqual({ material: "Copper", weight: { value: 2, unit: "kg" } });
        return json(
          detail(4, [
            { entry_id: IDS.entry, material: "Copper", weight: { value: 2, unit: "kg" } },
          ]),
          201,
        );
      },
    });
    const saved = await createHttpServices(API).processing.saveDraft(FIXTURE_IDS.record, {
      method: "material_recovery",
      notes: "Separated.",
      materialEntries: [{ material: "Copper", weight: { value: 2, unit: "kg" } }],
      offline: false,
    });
    expect(saved.version).toBe(4);
    expect(saved.material_entries[0]?.entry_id).toBe(IDS.entry);
  });

  it("submits processing with the evidence already attached to the draft", async () => {
    route({
      "GET /v1/auth/me": () => json(user("recycler")),
      "POST /v1/processing-submissions": ({ body }) => {
        const request = ProcessingRequestSchema.parse(body);
        expect(request.completion_evidence_ids).toEqual([IDS.completion]);
        expect(request.idempotency.scope.operation).toBe("record_processing");
        return json(
          {
            outcome: "review_required",
            recovery_record_id: FIXTURE_IDS.record,
            flag_codes: ["WEIGHT_DISCREPANCY"],
            replayed: false,
          },
          201,
        );
      },
    });
    await expect(
      createHttpServices(API).processing.submitProcessing({
        recordId: FIXTURE_IDS.record,
        method: "safe_storage",
        materialEntries: [],
        processedAt: timestamp,
        notes: "Secured for later treatment.",
        completionEvidenceIds: [IDS.completion],
        offline: false,
      }),
    ).resolves.toMatchObject({ outcome: "review_required" });
  });
});

describe("review adapter", () => {
  const summary = {
    case_id: IDS.caseId,
    record_id: FIXTURE_IDS.record,
    human_reference: "ST-DEMO0001",
    category: "televisions",
    status: "open",
    flag_codes: ["WEIGHT_DISCREPANCY"],
    opened_at: timestamp,
    facility_id: IDS.facility,
    record_business_state: "under_review",
    decision_eligible: true,
  };

  it("sends queue filters to the server", async () => {
    route({
      "GET /v1/review-cases": ({ url }) => {
        expect(url.searchParams.getAll("status")).toEqual(["open", "awaiting_information"]);
        expect(url.searchParams.get("flag_code")).toBe("WEIGHT_DISCREPANCY");
        expect(url.searchParams.get("facility_id")).toBe(IDS.facility);
        expect(url.searchParams.get("cursor")).toBe("page-2");
        return json({ items: [summary], pagination: { next_cursor: null, has_more: false } });
      },
    });
    const page = await createHttpServices(API).reviews.listCases({
      status: ["open", "awaiting_information"],
      flag_code: "WEIGHT_DISCREPANCY",
      facility_id: IDS.facility,
      cursor: "page-2",
    });
    expect(page.items[0]?.case_id).toBe(IDS.caseId);
  });

  it("opens a record's case through the server-side record filter", async () => {
    route({
      "GET /v1/review-cases": ({ url }) => {
        expect(url.searchParams.get("record_id")).toBe(FIXTURE_IDS.record);
        return json({ items: [summary], pagination: { next_cursor: null, has_more: false } });
      },
      [`GET /v1/review-cases/${IDS.caseId}`]: () =>
        json({
          case: summary,
          record: serverRecord({
            business_state: "under_review",
            review: {
              review_state: "open",
              flag_codes: ["WEIGHT_DISCREPANCY"],
              evidence_considered: [],
            },
          }),
          evidence: [evidenceMetadata(IDS.handoffPhoto, "handoff_photo")],
          timeline: [],
          decisions: [],
        }),
    });
    const detail = await createHttpServices(API).reviews.findCaseForRecord(FIXTURE_IDS.record);
    expect(detail?.case.case_id).toBe(IDS.caseId);
  });

  it("builds a decision from the case the reviewer read", async () => {
    route({
      "GET /v1/auth/me": () => json(user("programme_reviewer")),
      "POST /v1/review-decisions": ({ body }) => {
        const request = ProgrammeReviewRequestSchema.parse(body);
        expect(request).toMatchObject({
          decision: "request_correction",
          reason_code: "ADDITIONAL_EVIDENCE_REQUIRED",
          review_reason_codes: ["WEIGHT_DISCREPANCY"],
          previous_review_state: "open",
          previous_record_state: "under_review",
          assigned_reviewer: { actor_id: IDS.reviewer, programme_id: IDS.programme },
        });
        expect(request.idempotency.scope.operation).toBe("record_review_decision");
        return json(
          {
            recovery_record_id: FIXTURE_IDS.record,
            previous_review_state: "open",
            resulting_review_state: "awaiting_information",
            previous_record_state: "under_review",
            resulting_record_state: "under_review",
            decision_timestamp: timestamp,
            replayed: false,
          },
          201,
        );
      },
    });
    await expect(
      createHttpServices(API).reviews.submitDecision({
        recordId: FIXTURE_IDS.record,
        decision: "request_correction",
        reasonCode: "ADDITIONAL_EVIDENCE_REQUIRED",
        reviewerNote: "The scale reading is unreadable.",
        requestedCorrection: "Upload a clearer scale photograph.",
        reviewReasonCodes: ["WEIGHT_DISCREPANCY"],
        evidenceConsidered: [IDS.handoffPhoto],
        previousReviewState: "open",
        previousRecordState: "under_review",
      }),
    ).resolves.toMatchObject({ resulting_review_state: "awaiting_information" });
  });

  it("surfaces a stale decision as a version conflict", async () => {
    route({
      "GET /v1/auth/me": () => json(user("programme_reviewer")),
      "POST /v1/review-decisions": () => errorResponse(409, "VERSION_CONFLICT"),
    });
    await expect(
      createHttpServices(API).reviews.submitDecision({
        recordId: FIXTURE_IDS.record,
        decision: "approve",
        reasonCode: "EVIDENCE_SUFFICIENT",
        reviewerNote: "Consistent.",
        reviewReasonCodes: ["MANUAL_REVIEW"],
        evidenceConsidered: [IDS.handoffPhoto],
        previousReviewState: "open",
        previousRecordState: "under_review",
      }),
    ).rejects.toMatchObject({ envelope: { error: { code: "VERSION_CONFLICT" } } });
  });
});

describe("vision adapter over the API route", () => {
  it("sends the photograph to the authenticated appraisal route", async () => {
    route({
      "POST /v1/vision/appraise": ({ init }) => {
        expect((init.body as FormData).get("evidence_id")).toBe(evidenceId);
        return new Response(
          JSON.stringify({
            outcome: "unable_to_classify",
            reason: "low_confidence",
            scores,
            model_name: "scraptrace-vision-efficientnet-b0",
            model_version: "0.2.0",
            inferred_at: timestamp,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    await expect(createHttpServices(API).vision.appraise(upload())).resolves.toMatchObject({
      outcome: "unable_to_classify",
    });
  });
});

describe("HTTP transport", () => {
  it.each([401, 403, 404, 409, 413, 415, 422, 428, 429, 503])(
    "normalizes an empty %i response into a safe error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status })),
      );
      const request = new HttpClient(API).request("/v1/example", {
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
      new HttpClient(API).request("/v1/example", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("states deferred capabilities plainly instead of calling missing routes", async () => {
    const { fetchMock } = route({});
    await expect(
      createHttpServices(API).safetyGuidance.getGuidance({
        category: "televisions",
        requested_language: "en",
        transformation_mode: "none",
        offline: false,
      }),
    ).rejects.toMatchObject({
      envelope: { error: { code: "DEPENDENCY_UNAVAILABLE", retryable: false } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
