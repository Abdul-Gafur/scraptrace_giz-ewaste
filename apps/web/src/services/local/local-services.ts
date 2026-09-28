import {
  CONTRACT_SCHEMA_VERSION,
  SyncBatchRequestSchema,
  SyncBatchResponseSchema,
  UserRoleSchema,
  type SupportedLanguage,
  type UserRole,
} from "@scraptrace/contracts";

import { demoActorFor, type ActorContext } from "@/auth/actors";
import { nowUtc } from "@/services/domain/time";
import type {
  AuthenticationService,
  FrontendServices,
  LocalDataService,
  SynchronizationService,
} from "@/services/ports/service-ports";

import {
  createModelAdministrationService,
  createProgrammeSettingsService,
  createSafetyContentService,
} from "./admin-services";
import type { LocalServiceContext } from "./context";
import { createHandoffService } from "./handoff-service";
import { createLocationService } from "./location-service";
import { createProcessingService } from "./processing-service";
import { createRecordService } from "./record-service";
import { ScrapTraceRepository } from "./repository";
import { createReportingService, createDataExportService } from "./reporting-service";
import { createReviewService } from "./review-service";
import { createSafetyGuidanceService } from "./safety-service";
import { seedRepository } from "./seed";
import { createVisionService } from "./vision-service";

/**
 * Composition root for the browser-backed application services.
 *
 * One repository instance is shared by every service and every role in the tab, and it persists
 * through `localStorage`, so a record a collector submits is the same record the recycler scans
 * and the reviewer decides. Services are bound to one acting actor, which is what lets each call
 * enforce the contract permission rules for that actor without a screen passing a role.
 */

let sharedRepository: ScrapTraceRepository | null = null;

export const getSharedRepository = (): ScrapTraceRepository => {
  if (!sharedRepository) {
    sharedRepository = new ScrapTraceRepository();
    seedRepository(sharedRepository);
  }
  return sharedRepository;
};

/** Test support: drops the shared instance so each test starts from a known repository. */
export const resetSharedRepository = (): void => {
  sharedRepository = null;
};

const DEMO_SESSION_KEY = "scraptrace.demo.session";

const readDemoRole = (): UserRole | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(DEMO_SESSION_KEY);
  const parsed = UserRoleSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
};

const sessionFor = (role: UserRole, preferredLanguage: SupportedLanguage) => {
  const actor = demoActorFor(role);
  return {
    actorId: actor.actorId,
    role: actor.role,
    preferredLanguage,
    displayLabel: actor.displayLabelKey,
    developmentOnly: true,
  } as const;
};

const createAuthenticationService = (
  context: LocalServiceContext,
  preferredLanguage: SupportedLanguage,
): AuthenticationService => ({
  async getSession() {
    const role = readDemoRole();
    return role ? sessionFor(role, preferredLanguage) : null;
  },
  async signIn(input) {
    const role = UserRoleSchema.parse(input.demoRole ?? context.actor.role);
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_SESSION_KEY, role);
    return sessionFor(role, preferredLanguage);
  },
  async signOut() {
    // Signing out ends the session without deleting device records. Clearing locally held data is
    // a separate, explicitly confirmed account action.
    if (typeof window !== "undefined") window.localStorage.removeItem(DEMO_SESSION_KEY);
  },
});

/**
 * Local synchronization. Records are already written to the device store, so a batch is
 * acknowledged as created, or replayed when the same client mutation is sent twice.
 */
const createSynchronizationService = (context: LocalServiceContext): SynchronizationService => {
  const seen = new Set<string>();
  return {
    async synchronize(request) {
      const parsed = SyncBatchRequestSchema.parse(request);
      return SyncBatchResponseSchema.parse({
        contract_version: CONTRACT_SCHEMA_VERSION,
        results: parsed.mutations.map((mutation) => {
          const replayed = seen.has(mutation.client_mutation_id);
          seen.add(mutation.client_mutation_id);
          const record = context.repository.findRecord(mutation.record_id);
          return {
            outcome: "accepted",
            client_mutation_id: mutation.client_mutation_id,
            record_id: mutation.record_id,
            server_revision: record?.revision ?? 0,
            server_timestamp: nowUtc(),
            replay_status: replayed ? "replayed" : "created",
          };
        }),
        server_timestamp: nowUtc(),
      });
    },
  };
};

const createLocalDataService = (context: LocalServiceContext): LocalDataService => ({
  async summary() {
    const own = context.repository
      .listRecords()
      .filter((record) => record.collector.actor_id === context.actor.actorId);
    return {
      records: own.length,
      drafts: own.filter((record) => record.business_state === "draft").length,
      durable: context.repository.durable,
      storageWarning: context.repository.storageWarning,
    };
  },
  async clear() {
    context.repository.reset();
    seedRepository(context.repository);
  },
});

export interface LocalServiceOptions {
  readonly role?: UserRole;
  readonly actor?: ActorContext;
  readonly repository?: ScrapTraceRepository;
  readonly delayMilliseconds?: number;
  readonly preferredLanguage?: SupportedLanguage;
}

export const createLocalServices = ({
  role = UserRoleSchema.enum.collector,
  actor = demoActorFor(role),
  repository = getSharedRepository(),
  delayMilliseconds = 0,
  preferredLanguage = "en",
}: LocalServiceOptions = {}): FrontendServices => {
  const context: LocalServiceContext = { repository, actor, delayMilliseconds };
  return {
    authentication: createAuthenticationService(context, preferredLanguage),
    recoveryRecords: createRecordService(context),
    vision: createVisionService(context),
    safetyGuidance: createSafetyGuidanceService(context),
    locations: createLocationService(context),
    handoffs: createHandoffService(context),
    processing: createProcessingService(context),
    reviews: createReviewService(context),
    reporting: createReportingService(context),
    dataExports: createDataExportService(context),
    safetyContent: createSafetyContentService(context),
    modelAdministration: createModelAdministrationService(context),
    programmeSettings: createProgrammeSettingsService(context),
    synchronization: createSynchronizationService(context),
    localData: createLocalDataService(context),
  };
};

/** A fresh, isolated repository for one test. */
export const createTestServices = (
  options: Omit<LocalServiceOptions, "repository"> & {
    readonly repository?: ScrapTraceRepository;
    readonly seed?: boolean;
  } = {},
): { readonly services: FrontendServices; readonly repository: ScrapTraceRepository } => {
  const repository =
    options.repository ??
    new ScrapTraceRepository({
      durable: false,
      read: () => null,
      write: () => ({ ok: true }) as const,
      clear: () => undefined,
    });
  if (options.seed !== false && repository.isEmpty) seedRepository(repository);
  return {
    services: createLocalServices({ ...options, repository, delayMilliseconds: 0 }),
    repository,
  };
};
