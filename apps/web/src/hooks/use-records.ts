"use client";

import type { UserRole } from "@scraptrace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDevelopmentSession } from "@/auth/session";
import { queryKeys } from "@/lib/query-keys";
import { useServices } from "@/services/service-provider";
import type {
  CaptureInput,
  RecordHandoffInput,
  RecordProcessingInput,
  ReviewDecisionInput,
  UpdateDraftInput,
} from "@/services/ports/service-ports";

/**
 * Record queries and mutations.
 *
 * Every mutation invalidates the whole `records` root, so a change made by one role is reflected
 * the next time another role's screen reads the repository. That is what keeps a dashboard total,
 * a review queue and a record detail consistent without any of them re-implementing a rule.
 */

const useRole = (): UserRole => useDevelopmentSession().role;

export function useInvalidateRecords() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.records.root });
    void queryClient.invalidateQueries({ queryKey: ["report"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.model.feedback });
    void queryClient.invalidateQueries({ queryKey: queryKeys.localData });
  };
}

export function useOwnRecords() {
  const services = useServices();
  const role = useRole();
  return useQuery({
    queryKey: queryKeys.records.own(role),
    queryFn: () => services.recoveryRecords.listOwn(),
  });
}

export function useOperationalRecords() {
  const services = useServices();
  const role = useRole();
  return useQuery({
    queryKey: queryKeys.records.operational(role),
    queryFn: () => services.recoveryRecords.listOperational(),
  });
}

export function useRecord(recordId: string | undefined) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.detail(recordId ?? "none"),
    queryFn: () => services.recoveryRecords.getById(recordId ?? ""),
    enabled: Boolean(recordId),
  });
}

export function useRecordEvents(recordId: string | undefined) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.events(recordId ?? "none"),
    queryFn: () => services.recoveryRecords.listEvents(recordId ?? ""),
    enabled: Boolean(recordId),
  });
}

export function useRecordEvidence(recordId: string | undefined) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.evidence(recordId ?? "none"),
    queryFn: async () => {
      const evidence = await services.recoveryRecords.listEvidence(recordId ?? "");
      const images: Record<string, string | null> = {};
      for (const item of evidence) {
        images[item.evidence_id] = await services.recoveryRecords.getEvidenceImage(
          item.evidence_id,
        );
      }
      return { evidence, images };
    },
    enabled: Boolean(recordId),
  });
}

export function useReviewQueue() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.reviewQueue,
    queryFn: () => services.reviews.listQueue(),
  });
}

export function useCreateDraft() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (input: CaptureInput) => services.recoveryRecords.createDraft(input),
    onSuccess: invalidate,
  });
}

export function useUpdateDraft() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: UpdateDraftInput }) =>
      services.recoveryRecords.updateDraft(recordId, input),
    onSuccess: invalidate,
  });
}

export function useSubmitRecord() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (recordId: string) => services.recoveryRecords.submit(recordId),
    onSuccess: invalidate,
  });
}

export function useLookupForHandoff() {
  const services = useServices();
  return useMutation({
    mutationFn: (code: string) => services.recoveryRecords.lookupForHandoff(code),
  });
}

export function useConfirmHandoff() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (input: RecordHandoffInput) => services.handoffs.confirmReceipt(input),
    onSuccess: invalidate,
  });
}

export function useSubmitProcessing() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (input: RecordProcessingInput) => services.processing.submitProcessing(input),
    onSuccess: invalidate,
  });
}

export function useSubmitReviewDecision() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (input: ReviewDecisionInput) => services.reviews.submitDecision(input),
    onSuccess: invalidate,
  });
}
