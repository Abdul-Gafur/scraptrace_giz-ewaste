import {
  ActorIdSchema,
  UserRoleSchema,
  UuidV7Schema,
  type ActorReference,
  type AuthorizationContext,
  type RecoveryRecord,
  type UserRole,
} from "@scraptrace/contracts";

/**
 * Demonstration actors.
 *
 * These are fixed, fictional, opaque identifiers — not production authentication. They exist so
 * one recovery record can carry a stable owner, a stable receiving facility and a stable
 * reviewer across roles and page refreshes, and so the service layer has a real actor to
 * authorize. A production identity provider replaces this module without touching the services.
 */

const actorId = (value: string) => ActorIdSchema.parse(value);
const uuid = (value: string) => UuidV7Schema.parse(value);

export const DEMO_PROGRAMME_ID = uuid("0199b010-0010-7010-8010-000000000010");
export const DEMO_FACILITY_ID = uuid("0199b011-0011-7011-8011-000000000011");
/** A second facility, used to prove that facility scope actually denies access. */
export const OTHER_FACILITY_ID = uuid("0199b012-0012-7012-8012-000000000012");
export const DEMO_DEVICE_ID = uuid("0199b020-0020-7020-8020-000000000020");

export const DEMO_LOCATION_IDS = {
  collectionCentre: uuid("0199b031-0031-7031-8031-000000000031"),
  recycler: uuid("0199b032-0032-7032-8032-000000000032"),
  scrapyard: uuid("0199b033-0033-7033-8033-000000000033"),
} as const;

/** Locations operated by the demonstration facility the demo recycler is assigned to. */
export const DEMO_FACILITY_LOCATION_IDS: readonly string[] = [
  DEMO_LOCATION_IDS.collectionCentre,
  DEMO_LOCATION_IDS.recycler,
  DEMO_LOCATION_IDS.scrapyard,
];

export interface ActorContext {
  readonly actorId: string;
  readonly role: UserRole;
  readonly programmeId?: string;
  readonly facilityId?: string;
  /** Receiving locations this actor may act on. Empty for roles without facility scope. */
  readonly locationIds: readonly string[];
  readonly displayLabelKey: UserRole;
  readonly developmentOnly: true;
}

const role = UserRoleSchema.enum;

export const DEMO_ACTORS = {
  [role.collector]: {
    actorId: actorId("0199b001-0001-7001-8001-000000000001"),
    role: role.collector,
    programmeId: DEMO_PROGRAMME_ID,
    locationIds: [],
    displayLabelKey: role.collector,
    developmentOnly: true,
  },
  [role.recycler]: {
    actorId: actorId("0199b002-0002-7002-8002-000000000002"),
    role: role.recycler,
    programmeId: DEMO_PROGRAMME_ID,
    facilityId: DEMO_FACILITY_ID,
    locationIds: DEMO_FACILITY_LOCATION_IDS,
    displayLabelKey: role.recycler,
    developmentOnly: true,
  },
  [role.programme_reviewer]: {
    actorId: actorId("0199b003-0003-7003-8003-000000000003"),
    role: role.programme_reviewer,
    programmeId: DEMO_PROGRAMME_ID,
    locationIds: [],
    displayLabelKey: role.programme_reviewer,
    developmentOnly: true,
  },
  [role.programme_manager]: {
    actorId: actorId("0199b004-0004-7004-8004-000000000004"),
    role: role.programme_manager,
    programmeId: DEMO_PROGRAMME_ID,
    locationIds: [],
    displayLabelKey: role.programme_manager,
    developmentOnly: true,
  },
  [role.safety_content_administrator]: {
    actorId: actorId("0199b005-0005-7005-8005-000000000005"),
    role: role.safety_content_administrator,
    programmeId: DEMO_PROGRAMME_ID,
    locationIds: [],
    displayLabelKey: role.safety_content_administrator,
    developmentOnly: true,
  },
  [role.data_ml_reviewer]: {
    actorId: actorId("0199b006-0006-7006-8006-000000000006"),
    role: role.data_ml_reviewer,
    programmeId: DEMO_PROGRAMME_ID,
    locationIds: [],
    displayLabelKey: role.data_ml_reviewer,
    developmentOnly: true,
  },
} as const satisfies Record<UserRole, ActorContext>;

export const demoActorFor = (userRole: UserRole): ActorContext => DEMO_ACTORS[userRole];

/** The contract actor reference stored on a record, an event or a piece of evidence. */
export const toActorReference = (actor: ActorContext): ActorReference => ({
  actor_id: ActorIdSchema.parse(actor.actorId),
  ...(actor.programmeId ? { programme_id: uuid(actor.programmeId) } : {}),
  ...(actor.facilityId ? { facility_id: uuid(actor.facilityId) } : {}),
});

/** The receiving location a record is destined for or was received at. */
export const recordLocationId = (record: RecoveryRecord): string | undefined =>
  record.handoff?.receiving_location_id ?? record.destination?.location_id;

/**
 * Builds the contract authorization context for one actor, optionally scoped to one record.
 * `isPermissionAllowed` then decides; this function never decides on its own.
 */
export const authorizationContextFor = (
  actor: ActorContext,
  options: {
    readonly record?: RecoveryRecord;
    readonly personalDataRequired?: boolean;
    readonly ownsResource?: boolean;
  } = {},
): AuthorizationContext => {
  const { record } = options;
  const locationId = record ? recordLocationId(record) : undefined;
  return {
    owns_resource: record ? record.collector.actor_id === actor.actorId : false,
    assigned_programme:
      actor.programmeId !== undefined &&
      (!record ||
        record.collector.programme_id === undefined ||
        record.collector.programme_id === actor.programmeId),
    assigned_facility:
      actor.locationIds.length > 0 &&
      (locationId === undefined || actor.locationIds.includes(locationId)),
    assigned_review: actor.role === role.programme_reviewer,
    personal_data_required: options.personalDataRequired ?? false,
  };
};
