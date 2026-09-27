import {
  EvidenceSchema,
  RecoveryRecordEventSchema,
  RecoveryRecordSchema,
  compareIdempotencyRequest,
  type Evidence,
  type IdempotencyMetadata,
  type RecoveryRecord,
  type RecoveryRecordEvent,
} from "@scraptrace/contracts";

import {
  ModelConfigurationSchema,
  PredictionFeedbackSchema,
  type ModelConfiguration,
  type PredictionFeedback,
} from "@/services/domain/model-administration";
import {
  ProgrammeSettingsSchema,
  type ProgrammeSettings,
} from "@/services/domain/programme-settings";
import { SafetyCardSchema, type SafetyCard } from "@/services/domain/safety-content";

import { createPersistentStore, type PersistentStore } from "./persistence";

/**
 * The shared demonstration repository.
 *
 * One store holds every recovery record, every piece of evidence, the append-only event log,
 * the idempotency ledger, safety cards, model configuration, stored prediction feedback and
 * programme settings. All six roles read and write the same store, so a change one role makes is
 * visible to the next role that opens the record.
 *
 * Seed data is written through the same `put` methods and the same contract schemas as anything
 * a user creates, so nothing in the repository is display-only sample data.
 *
 * Everything is parsed on load: content that no longer satisfies its contract is discarded
 * rather than handed to a screen.
 */

const STORAGE_KEY = "scraptrace.repository.v1";

/** Stored evidence images are capped so one large capture cannot exhaust the storage quota. */
const MAX_STORED_IMAGE_BYTES = 120_000;
const MAX_STORED_IMAGES = 40;

interface IdempotencyRecord {
  readonly metadata: IdempotencyMetadata;
  /** The response that was returned the first time, replayed verbatim on a repeat. */
  readonly response: unknown;
  readonly recordedAt: string;
}

interface RepositoryState {
  records: RecoveryRecord[];
  evidence: Evidence[];
  events: RecoveryRecordEvent[];
  idempotency: IdempotencyRecord[];
  safetyCards: SafetyCard[];
  predictionFeedback: PredictionFeedback[];
  modelConfiguration: ModelConfiguration | null;
  programmeSettings: ProgrammeSettings | null;
  /** Evidence identifier to a small data URL, for redisplaying a capture. */
  evidenceImages: Record<string, string>;
}

const emptyState = (): RepositoryState => ({
  records: [],
  evidence: [],
  events: [],
  idempotency: [],
  safetyCards: [],
  predictionFeedback: [],
  modelConfiguration: null,
  programmeSettings: null,
  evidenceImages: {},
});

const parseList = <T>(value: unknown, parse: (item: unknown) => T | null): T[] => {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed !== null) result.push(parsed);
  }
  return result;
};

const safe =
  <T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }) =>
  (value: unknown): T | null => {
    const parsed = schema.safeParse(value);
    return parsed.success && parsed.data !== undefined ? parsed.data : null;
  };

const readState = (store: PersistentStore): RepositoryState => {
  const raw = store.read();
  if (!raw || typeof raw !== "object") return emptyState();
  const candidate = raw as Partial<Record<keyof RepositoryState, unknown>>;
  const images =
    candidate.evidenceImages && typeof candidate.evidenceImages === "object"
      ? Object.fromEntries(
          Object.entries(candidate.evidenceImages as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  return {
    records: parseList(candidate.records, safe(RecoveryRecordSchema)),
    evidence: parseList(candidate.evidence, safe(EvidenceSchema)),
    events: parseList(candidate.events, safe(RecoveryRecordEventSchema)),
    idempotency: Array.isArray(candidate.idempotency)
      ? (candidate.idempotency as IdempotencyRecord[])
      : [],
    safetyCards: parseList(candidate.safetyCards, safe(SafetyCardSchema)),
    predictionFeedback: parseList(candidate.predictionFeedback, safe(PredictionFeedbackSchema)),
    modelConfiguration: safe(ModelConfigurationSchema)(candidate.modelConfiguration),
    programmeSettings: safe(ProgrammeSettingsSchema)(candidate.programmeSettings),
    evidenceImages: images,
  };
};

export type StorageWarning = "storage_full" | "storage_unavailable" | "serialization_failed";

export class ScrapTraceRepository {
  private state: RepositoryState;
  private readonly listeners = new Set<() => void>();
  private lastStorageWarning: StorageWarning | null = null;

  constructor(private readonly store: PersistentStore = createPersistentStore(STORAGE_KEY)) {
    this.state = readState(store);
  }

  /** True when writes survive a page refresh. False in a private window or blocked storage. */
  get durable(): boolean {
    return this.store.durable;
  }

  /** The last failed write, so a screen can warn instead of claiming that work was saved. */
  get storageWarning(): StorageWarning | null {
    return this.lastStorageWarning;
  }

  get isEmpty(): boolean {
    return this.state.records.length === 0 && this.state.safetyCards.length === 0;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    const result = this.store.write(this.state);
    this.lastStorageWarning = result.ok ? null : (result.reason as StorageWarning);
    for (const listener of this.listeners) listener();
  }

  reset(): void {
    this.state = emptyState();
    this.store.clear();
    this.lastStorageWarning = null;
    for (const listener of this.listeners) listener();
  }

  // Recovery records -------------------------------------------------------

  listRecords(): readonly RecoveryRecord[] {
    return this.state.records;
  }

  findRecord(recordId: string): RecoveryRecord | null {
    return this.state.records.find((record) => record.record_id === recordId) ?? null;
  }

  findRecordByLookupToken(token: string): RecoveryRecord | null {
    return this.state.records.find((record) => record.qr_payload.lookup_token === token) ?? null;
  }

  findRecordByHumanReference(reference: string): RecoveryRecord | null {
    return this.state.records.find((record) => record.human_reference === reference) ?? null;
  }

  /** Inserts or replaces a record. The value is contract-parsed before it is stored. */
  putRecord(record: unknown): RecoveryRecord {
    const parsed = RecoveryRecordSchema.parse(record);
    const index = this.state.records.findIndex((item) => item.record_id === parsed.record_id);
    if (index >= 0) this.state.records[index] = parsed;
    else this.state.records.push(parsed);
    this.commit();
    return parsed;
  }

  // Evidence ---------------------------------------------------------------

  listEvidence(recordId: string): readonly Evidence[] {
    return this.state.evidence.filter((item) => item.recovery_record_id === recordId);
  }

  findEvidence(evidenceId: string): Evidence | null {
    return this.state.evidence.find((item) => item.evidence_id === evidenceId) ?? null;
  }

  /**
   * Exact content reuse across records. Returns the records that already hold the same digest,
   * which becomes a review flag rather than an automatic approval or rejection (FR-REC-007).
   */
  findRecordsWithEvidenceDigest(digest: string, exceptRecordId?: string): readonly string[] {
    return [
      ...new Set(
        this.state.evidence
          .filter(
            (item) => item.content_digest === digest && item.recovery_record_id !== exceptRecordId,
          )
          .map((item) => item.recovery_record_id),
      ),
    ];
  }

  putEvidence(evidence: unknown, image?: string): Evidence {
    const parsed = EvidenceSchema.parse(evidence);
    const index = this.state.evidence.findIndex((item) => item.evidence_id === parsed.evidence_id);
    if (index >= 0) this.state.evidence[index] = parsed;
    else this.state.evidence.push(parsed);
    if (image !== undefined && image.length <= MAX_STORED_IMAGE_BYTES) {
      const keys = Object.keys(this.state.evidenceImages);
      if (keys.length >= MAX_STORED_IMAGES) {
        const oldest = keys[0];
        if (oldest !== undefined) delete this.state.evidenceImages[oldest];
      }
      this.state.evidenceImages[parsed.evidence_id] = image;
    }
    this.commit();
    return parsed;
  }

  findEvidenceImage(evidenceId: string): string | null {
    return this.state.evidenceImages[evidenceId] ?? null;
  }

  // Events (append-only) --------------------------------------------------

  listEvents(recordId?: string): readonly RecoveryRecordEvent[] {
    const events = recordId
      ? this.state.events.filter((event) => event.recovery_record_id === recordId)
      : this.state.events;
    return [...events].sort((first, second) => first.occurred_at.localeCompare(second.occurred_at));
  }

  appendEvent(event: unknown): RecoveryRecordEvent {
    const parsed = RecoveryRecordEventSchema.parse(event);
    this.state.events.push(parsed);
    this.commit();
    return parsed;
  }

  // Idempotency ----------------------------------------------------------

  /**
   * Applies the contract comparison rule (BR-007): an identical repeat replays the first
   * response, a reused key with a different payload is a conflict, anything else is new.
   */
  checkIdempotency(incoming: IdempotencyMetadata): {
    readonly decision: ReturnType<typeof compareIdempotencyRequest>;
    readonly stored: IdempotencyRecord | undefined;
  } {
    const stored = this.state.idempotency.find(
      (entry) =>
        entry.metadata.idempotency_key === incoming.idempotency_key &&
        entry.metadata.scope.actor_id === incoming.scope.actor_id &&
        entry.metadata.scope.operation === incoming.scope.operation &&
        entry.metadata.scope.resource_id === incoming.scope.resource_id,
    );
    return { decision: compareIdempotencyRequest(stored?.metadata, incoming), stored };
  }

  recordIdempotency(metadata: IdempotencyMetadata, response: unknown, recordedAt: string): void {
    this.state.idempotency.push({ metadata, response, recordedAt });
    this.commit();
  }

  // Safety cards ---------------------------------------------------------

  listSafetyCards(): readonly SafetyCard[] {
    return this.state.safetyCards;
  }

  findSafetyCard(cardId: string): SafetyCard | null {
    return this.state.safetyCards.find((card) => card.card_id === cardId) ?? null;
  }

  putSafetyCard(card: unknown): SafetyCard {
    const parsed = SafetyCardSchema.parse(card);
    const index = this.state.safetyCards.findIndex((item) => item.card_id === parsed.card_id);
    if (index >= 0) this.state.safetyCards[index] = parsed;
    else this.state.safetyCards.push(parsed);
    this.commit();
    return parsed;
  }

  // Prediction feedback --------------------------------------------------

  listPredictionFeedback(): readonly PredictionFeedback[] {
    return this.state.predictionFeedback;
  }

  putPredictionFeedback(feedback: unknown): PredictionFeedback {
    const parsed = PredictionFeedbackSchema.parse(feedback);
    const index = this.state.predictionFeedback.findIndex(
      (item) => item.feedback_id === parsed.feedback_id,
    );
    if (index >= 0) this.state.predictionFeedback[index] = parsed;
    else this.state.predictionFeedback.push(parsed);
    this.commit();
    return parsed;
  }

  // Configuration --------------------------------------------------------

  getModelConfiguration(): ModelConfiguration | null {
    return this.state.modelConfiguration;
  }

  putModelConfiguration(configuration: unknown): ModelConfiguration {
    const parsed = ModelConfigurationSchema.parse(configuration);
    this.state.modelConfiguration = parsed;
    this.commit();
    return parsed;
  }

  getProgrammeSettings(): ProgrammeSettings | null {
    return this.state.programmeSettings;
  }

  putProgrammeSettings(settings: unknown): ProgrammeSettings {
    const parsed = ProgrammeSettingsSchema.parse(settings);
    this.state.programmeSettings = parsed;
    this.commit();
    return parsed;
  }
}
