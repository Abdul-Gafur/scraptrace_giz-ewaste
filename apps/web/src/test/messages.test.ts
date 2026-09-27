import {
  EwasteCategorySchema,
  HandoffStateSchema,
  ItemConditionSchema,
  PermissionSchema,
  ProcessingStateSchema,
  RecordKindSchema,
  RecoveryRecordEventTypeSchema,
  RecoveryRecordStateSchema,
  ReviewStateSchema,
  SupportedLanguageSchema,
  UserRoleSchema,
  EvidenceTypeSchema,
  FacilityTypeSchema,
  FacilityVerificationStatusSchema,
  SynchronizationStateSchema,
} from "@scraptrace/contracts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { REVIEW_FLAG_CODES, REVIEW_REASON_CODES } from "@/services/domain/flags";
import { SAFETY_QUESTION_KEYS } from "@/services/domain/safety-content";

import { bundles, type TestLocale } from "./render";

const LOCALES = Object.keys(bundles) as TestLocale[];
const SOURCE = path.resolve(import.meta.dirname, "..");

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const flatten = (value: Json, prefix = ""): string[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    flatten(nested as Json, prefix ? `${prefix}.${key}` : key),
  );
};

const lookup = (bundle: Json, dotted: string): Json | undefined =>
  dotted
    .split(".")
    .reduce<
      Json | undefined
    >((node, part) => (node && typeof node === "object" && !Array.isArray(node) ? (node as Record<string, Json>)[part] : undefined), bundle);

const sourceFiles = (): string[] => {
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const full = path.join(directory, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return walk(SOURCE).filter(
    (file) => /\.tsx?$/.test(file) && !file.includes(`${path.sep}test${path.sep}`),
  );
};

/**
 * Literal message keys referenced by the source, grouped by namespace.
 *
 * A file may open several namespaces, so each translator variable is tracked separately. Keys built
 * from a value at runtime are checked separately, against the contract enumeration they come from.
 */
const referencedKeys = (): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    const namespaces = new Map<string, string>();
    const declaration =
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?["'`]([^"'`]+)["'`]/g;
    for (const match of source.matchAll(declaration)) {
      const [, variable, namespace] = match;
      if (variable && namespace) namespaces.set(variable, namespace);
    }
    for (const [variable, namespace] of namespaces) {
      const call = new RegExp(`\\b${variable}(?:\\.has)?\\(\\s*(["'\`])([^"'\`$]*?)\\1`, "g");
      for (const match of source.matchAll(call)) {
        const key = match[2];
        if (key === undefined || key.length === 0) continue;
        const set = found.get(namespace) ?? new Set<string>();
        set.add(key);
        found.set(namespace, set);
      }
    }
  }
  return found;
};

/**
 * Namespaces whose keys are looked up from a contract value at runtime. Every member of the
 * enumeration must therefore have a label in every language.
 */
const ENUM_NAMESPACES: Readonly<Record<string, readonly string[]>> = {
  categories: EwasteCategorySchema.options,
  conditions: ItemConditionSchema.options,
  recordKinds: RecordKindSchema.options,
  handoffStates: HandoffStateSchema.options,
  processingStates: ProcessingStateSchema.options,
  reviewStates: ReviewStateSchema.options,
  evidenceTypes: EvidenceTypeSchema.options,
  events: RecoveryRecordEventTypeSchema.options,
  facilityTypes: FacilityTypeSchema.options,
  verificationStatuses: FacilityVerificationStatusSchema.options,
  languages: SupportedLanguageSchema.options,
  roles: UserRoleSchema.options,
  workspaces: UserRoleSchema.options,
  roleDescriptions: UserRoleSchema.options,
  flags: REVIEW_FLAG_CODES,
  reviewReasons: REVIEW_REASON_CODES,
  safetyQuestions: SAFETY_QUESTION_KEYS,
  reviewDecisions: ["approve", "reject", "request_correction"],
  confirmationSources: ["accepted_prediction", "manual_selection", "human_correction"],
  cardStatuses: ["draft", "approved", "published", "archived"],
  feedbackStates: ["stored_for_review", "approved_for_training_dataset", "rejected_for_training"],
  captureSources: [
    "in_app_camera",
    "recycler_camera",
    "document_scanner",
    "approved_demo_fixture",
    "system_generated",
  ],
  processingMethods: [
    "reuse_referral",
    "repair_referral",
    "material_recovery",
    "safe_storage",
    "other_reviewed",
  ],
  status: [
    ...RecoveryRecordStateSchema.options,
    ...SynchronizationStateSchema.options,
    "awaiting_information",
    "verified_gps",
    "unverified_gps",
  ],
  "record.nextStep": RecoveryRecordStateSchema.options,
  "errors.transition": [
    "TERMINAL_STATE",
    "TRANSITION_NOT_ALLOWED",
    "ROLE_NOT_ALLOWED",
    "MISSING_EVIDENCE",
    "UNRESOLVED_FLAGS",
    "OFFLINE_NOT_ALLOWED",
  ],
  "screens.reviewDetail.decisionHint": ["approve", "reject", "request_correction"],
  "screens.reviewDetail.decided": ["approved_and_completed", "rejected", "under_review"],
  "screens.safetyEditor.questionHint": SAFETY_QUESTION_KEYS,
  "screens.safetyEditor.statusChanged": ["published", "archived", "draft"],
  "screens.mlCorrections.decided": ["approved_for_training_dataset", "rejected_for_training"],
  "screens.mlModel.status": ["active", "registered", "retired"],
  "screens.mlConfiguration.routing": ["manual_confirmation", "manual_confirmation_and_feedback"],
  "screens.mlConfiguration.routingHint": [
    "manual_confirmation",
    "manual_confirmation_and_feedback",
  ],
  "screens.capture.confidence": ["high", "medium", "low"],
  "screens.capture.imageRejected": ["unsupported_type", "too_large"],
  "screens.recyclerIntake.imageRejected": ["unsupported_type", "too_large"],
  "screens.recyclerProcessing.imageRejected": ["unsupported_type", "too_large"],
  "screens.clearCache.storageWarning": [
    "storage_full",
    "storage_unavailable",
    "serialization_failed",
  ],
  "screens.safetyApprovals": ["noDrafts", "noApproved", "noExpired"],
  "safety.fallbackReason": [
    "no_approved_card",
    "provider_unavailable",
    "invalid_generated_output",
    "offline_cache_unavailable",
  ],
};

/**
 * Keys the scanner attributes to the wrong namespace because a file opens more than one and the
 * regular expression cannot tell which variable a call used. Each is verified in the namespace it
 * really belongs to by another assertion in this file.
 */
const SCANNER_FALSE_POSITIVES = new Set([
  "common.title",
  "common.description",
  "status.banner",
  "status.online",
]);

describe("message bundles", () => {
  it("has exactly the same keys in all four languages", () => {
    const reference = flatten(bundles.en as Json).sort();
    for (const locale of LOCALES) {
      // The locale is folded into the compared value so a failure names the language.
      expect({ locale, keys: flatten(bundles[locale] as Json).sort() }).toEqual({
        locale,
        keys: reference,
      });
    }
  });

  it("has a non-empty string for every key in every language", () => {
    const empty: string[] = [];
    for (const locale of LOCALES) {
      for (const key of flatten(bundles[locale] as Json)) {
        const value = lookup(bundles[locale] as Json, key);
        if (typeof value !== "string" || value.trim().length === 0) {
          empty.push(`${locale}.${key}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it("resolves every message key the source references", () => {
    const missing: string[] = [];
    for (const [namespace, keys] of referencedKeys()) {
      for (const key of keys) {
        const dotted = `${namespace}.${key}`;
        if (SCANNER_FALSE_POSITIVES.has(dotted)) continue;
        if (typeof lookup(bundles.en as Json, dotted) !== "string") missing.push(dotted);
      }
    }
    expect(missing).toEqual([]);
  });

  it("labels every contract enumeration value in every language", () => {
    const missing: string[] = [];
    for (const [namespace, members] of Object.entries(ENUM_NAMESPACES)) {
      for (const member of members) {
        for (const locale of LOCALES) {
          if (typeof lookup(bundles[locale] as Json, `${namespace}.${member}`) !== "string") {
            missing.push(`${locale}.${namespace}.${member}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("names every permission the navigation configuration requires", () => {
    for (const value of PermissionSchema.options) {
      expect(PermissionSchema.safeParse(value).success).toBe(true);
    }
  });

  it("contains no unbuilt-milestone wording in any language", () => {
    const forbidden = [
      /later milestone/i,
      /in a future milestone/i,
      /not implemented yet/i,
      /coming soon/i,
      /placeholder/i,
      /lorem ipsum/i,
      /\bTODO\b/,
      /sample data/i,
    ];
    const offenders: string[] = [];
    for (const locale of LOCALES) {
      for (const key of flatten(bundles[locale] as Json)) {
        const value = lookup(bundles[locale] as Json, key) as string;
        if (forbidden.some((pattern) => pattern.test(value))) offenders.push(`${locale}.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every interpolation placeholder identical across languages", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatched: string[] = [];
    for (const key of flatten(bundles.en as Json)) {
      const expected = placeholders(lookup(bundles.en as Json, key) as string);
      for (const locale of LOCALES) {
        const actual = placeholders(lookup(bundles[locale] as Json, key) as string);
        if (JSON.stringify(expected) !== JSON.stringify(actual))
          mismatched.push(`${locale}.${key}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("leaves stored identifiers untranslated: no bundle rewrites a contract enumeration value", () => {
    // A label may differ per language, but the key it is stored under is the contract value.
    for (const [namespace, members] of Object.entries(ENUM_NAMESPACES)) {
      const node = lookup(bundles.en as Json, namespace) as Record<string, Json>;
      for (const member of members) expect(Object.keys(node)).toContain(member);
    }
  });

  it("has no user-facing hard-coded sentence left in a completed screen", () => {
    // A quoted sentence in JSX text position would bypass translation entirely. The check looks for
    // JSX text nodes of two or more words that are not an expression, an attribute or a comment.
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      if (!file.endsWith(".tsx")) continue;
      if (file.includes(`${path.sep}dev${path.sep}`)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        />\s*([A-Z][A-Za-z]+(?: [a-z][A-Za-z]+){2,})[.!?]?\s*</g,
      )) {
        offenders.push(`${path.relative(SOURCE, file)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
