"use client";

import type {
  EwasteCategory,
  EvidenceType,
  HandoffState,
  ProcessingState,
  RecoveryRecordEventType,
  RecoveryRecordState,
  ReviewState,
  SupportedLanguage,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

/**
 * Translated labels for contract enumeration values.
 *
 * The stored value never changes: only its presentation is translated, and the raw value stays
 * available through `data-value` so a demonstration can show what is actually recorded.
 */

export function useContractLabels() {
  const category = useTranslations("categories");
  const condition = useTranslations("conditions");
  const recordKind = useTranslations("recordKinds");
  const handoffState = useTranslations("handoffStates");
  const processingState = useTranslations("processingStates");
  const reviewState = useTranslations("reviewStates");
  const evidenceType = useTranslations("evidenceTypes");
  const captureSource = useTranslations("captureSources");
  const event = useTranslations("events");
  const flag = useTranslations("flags");
  const reason = useTranslations("reviewReasons");
  const method = useTranslations("processingMethods");
  const facilityType = useTranslations("facilityTypes");
  const verification = useTranslations("verificationStatuses");
  const language = useTranslations("languages");
  const decision = useTranslations("reviewDecisions");
  const confirmation = useTranslations("confirmationSources");
  const cardStatus = useTranslations("cardStatuses");
  const feedbackState = useTranslations("feedbackStates");

  return {
    category: (value: EwasteCategory) => category(value),
    condition: (value: string) => condition(value),
    recordKind: (value: string) => recordKind(value),
    handoffState: (value: HandoffState) => handoffState(value),
    processingState: (value: ProcessingState) => processingState(value),
    reviewState: (value: ReviewState) => reviewState(value),
    evidenceType: (value: EvidenceType) => evidenceType(value),
    captureSource: (value: string) => captureSource(value),
    event: (value: RecoveryRecordEventType) => event(value),
    /** Unknown flag codes fall back to the raw code so nothing is silently hidden. */
    flag: (value: string) => (flag.has(value) ? flag(value) : value),
    reason: (value: string) => (reason.has(value) ? reason(value) : value),
    method: (value: string) => method(value),
    facilityType: (value: string) => facilityType(value),
    verification: (value: string) => verification(value),
    language: (value: SupportedLanguage) => language(value),
    decision: (value: string) => decision(value),
    confirmation: (value: string) => confirmation(value),
    cardStatus: (value: string) => cardStatus(value),
    feedbackState: (value: string) => feedbackState(value),
  };
}

export function CategoryLabel({ value }: { value: EwasteCategory }) {
  const translate = useTranslations("categories");
  return <span data-value={value}>{translate(value)}</span>;
}

/** Lifecycle state label used where a badge would be too heavy. */
export function RecordStateLabel({ value }: { value: RecoveryRecordState }) {
  const translate = useTranslations("status");
  return <span data-value={value}>{translate(value)}</span>;
}
