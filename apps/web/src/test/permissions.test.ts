import {
  PermissionSchema,
  ROLE_PERMISSIONS,
  UserRoleSchema,
  isPermissionAllowed,
  type Permission,
  type RecoveryRecord,
} from "@scraptrace/contracts";

import {
  DEMO_ACTORS,
  DEMO_LOCATION_IDS,
  OTHER_FACILITY_ID,
  authorizationContextFor,
  recordLocationId,
} from "@/auth/actors";
import { ensureSeeded, seedRepository } from "@/services/local/seed";
import { ScrapTraceRepository } from "@/services/local/repository";

const permission = PermissionSchema.enum;
const role = UserRoleSchema.enum;

const makeRepository = () =>
  new ScrapTraceRepository({
    durable: false,
    read: () => null,
    write: () => ({ ok: true }) as const,
    clear: () => undefined,
  });

let records: readonly RecoveryRecord[];

beforeAll(async () => {
  const repository = makeRepository();
  seedRepository(repository);
  await ensureSeeded(repository);
  records = repository.listRecords();
});

const allow = (
  actor: (typeof DEMO_ACTORS)[keyof typeof DEMO_ACTORS],
  value: Permission,
  record?: RecoveryRecord,
) =>
  isPermissionAllowed(actor.role, value, authorizationContextFor(actor, record ? { record } : {}));

describe("demonstration actors", () => {
  it("defines one actor per contract role, with distinct identifiers", () => {
    expect(Object.keys(DEMO_ACTORS).sort()).toEqual([...UserRoleSchema.options].sort());
    const ids = Object.values(DEMO_ACTORS).map((actor) => actor.actorId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only gives facility scope to the recycler", () => {
    for (const actor of Object.values(DEMO_ACTORS)) {
      expect(actor.locationIds.length > 0).toBe(actor.role === role.recycler);
    }
  });

  it("marks every actor as development-only", () => {
    for (const actor of Object.values(DEMO_ACTORS)) expect(actor.developmentOnly).toBe(true);
  });
});

describe("contract permission enforcement per role", () => {
  it("lets a collector act on their own record and not on someone else's", () => {
    const own = records.find(
      (record) => record.collector.actor_id === DEMO_ACTORS.collector.actorId,
    );
    expect(own).toBeDefined();
    expect(allow(DEMO_ACTORS.collector, permission["recovery_record:view_own"], own)).toBe(true);

    const foreign = {
      ...(own as RecoveryRecord),
      collector: { actor_id: DEMO_ACTORS.recycler.actorId },
    };
    expect(
      allow(
        DEMO_ACTORS.collector,
        permission["recovery_record:view_own"],
        foreign as RecoveryRecord,
      ),
    ).toBe(false);
  });

  it("denies the collector every operational and administrative permission", () => {
    for (const value of [
      permission["handoff:record"],
      permission["processing:record"],
      permission["review:approve"],
      permission["programme_report:view"],
      permission["programme_data:export"],
      permission["safety_content:manage"],
      permission["model_correction:review"],
    ] as const) {
      expect(allow(DEMO_ACTORS.collector, value)).toBe(false);
    }
  });

  it("lets a recycler record a handoff at an assigned location", () => {
    const awaiting = records.find(
      (record) => recordLocationId(record) === DEMO_LOCATION_IDS.recycler,
    );
    expect(awaiting).toBeDefined();
    expect(allow(DEMO_ACTORS.recycler, permission["handoff:record"], awaiting)).toBe(true);
    expect(allow(DEMO_ACTORS.recycler, permission["processing:record"], awaiting)).toBe(true);
  });

  it("denies a recycler assigned to another facility", () => {
    const other = {
      ...DEMO_ACTORS.recycler,
      facilityId: OTHER_FACILITY_ID,
      locationIds: [] as readonly string[],
    };
    expect(allow(other, permission["handoff:record"])).toBe(false);
  });

  it("denies a recycler a record destined elsewhere", () => {
    const record = records.find((candidate) => recordLocationId(candidate) !== undefined);
    const elsewhere = {
      ...(record as RecoveryRecord),
      handoff: undefined,
      destination: {
        location_id: OTHER_FACILITY_ID,
        facility_type: "recycler" as const,
        verification_status: "programme_verified" as const,
        selected_at: "2026-09-20T08:00:00.000Z",
      },
    };
    expect(
      allow(DEMO_ACTORS.recycler, permission["handoff:record"], elsewhere as RecoveryRecord),
    ).toBe(false);
  });

  it("denies a recycler every review decision", () => {
    for (const value of [
      permission["review:approve"],
      permission["review:reject"],
      permission["review:request_correction"],
    ] as const) {
      expect(allow(DEMO_ACTORS.recycler, value, records[0])).toBe(false);
    }
  });

  it("lets a reviewer decide, and denies a reviewer the recycler's actions", () => {
    const underReview = records.find((record) => record.business_state === "under_review");
    expect(underReview).toBeDefined();
    for (const value of [
      permission["review:approve"],
      permission["review:reject"],
      permission["review:request_correction"],
      permission["review:evidence"],
    ] as const) {
      expect(allow(DEMO_ACTORS.programme_reviewer, value, underReview)).toBe(true);
    }
    expect(allow(DEMO_ACTORS.programme_reviewer, permission["handoff:record"], underReview)).toBe(
      false,
    );
    expect(
      allow(DEMO_ACTORS.programme_reviewer, permission["processing:record"], underReview),
    ).toBe(false);
  });

  it("lets a manager report and export, and denies a manager the review decisions", () => {
    expect(allow(DEMO_ACTORS.programme_manager, permission["programme_report:view"])).toBe(true);
    expect(allow(DEMO_ACTORS.programme_manager, permission["programme_data:export"])).toBe(true);
    expect(allow(DEMO_ACTORS.programme_manager, permission["review:approve"])).toBe(false);
    expect(allow(DEMO_ACTORS.programme_manager, permission["safety_content:manage"])).toBe(false);
  });

  it("lets the safety administrator manage content and nothing else", () => {
    const actor = DEMO_ACTORS.safety_content_administrator;
    expect(allow(actor, permission["safety_content:manage"])).toBe(true);
    for (const value of [
      permission["recovery_record:view_operational"],
      permission["programme_report:view"],
      permission["model_correction:review"],
      permission["handoff:record"],
    ] as const) {
      expect(allow(actor, value)).toBe(false);
    }
  });

  it("lets the model reviewer review corrections and see performance, and nothing else", () => {
    const actor = DEMO_ACTORS.data_ml_reviewer;
    expect(allow(actor, permission["model_correction:review"])).toBe(true);
    expect(allow(actor, permission["model_performance:view"])).toBe(true);
    for (const value of [
      permission["safety_content:manage"],
      permission["programme_data:export"],
      permission["review:approve"],
      permission["recovery_record:create"],
    ] as const) {
      expect(allow(actor, value)).toBe(false);
    }
  });

  it("refuses a permission the contract does not grant the role, for every role", () => {
    for (const actor of Object.values(DEMO_ACTORS)) {
      for (const value of PermissionSchema.options) {
        if (ROLE_PERMISSIONS[actor.role].has(value)) continue;
        expect(allow(actor, value, records[0])).toBe(false);
      }
    }
  });

  it("refuses any permission when personal data is required and the role may not see it", () => {
    for (const actor of [DEMO_ACTORS.collector, DEMO_ACTORS.recycler]) {
      const context = authorizationContextFor(actor, { personalDataRequired: true });
      for (const value of PermissionSchema.options) {
        expect(isPermissionAllowed(actor.role, value, context)).toBe(false);
      }
    }
  });
});
