"use client";

import type {
  EvidenceMetadata,
  RecoveryRecordListRequest,
  ReviewQueueFilters,
  UserRole,
} from "@scraptrace/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDevelopmentSession } from "@/auth/session";
import { queryKeys } from "@/lib/query-keys";
import { useServices } from "@/services/service-provider";
import type {
  AddEvidenceInput,
  CaptureInput,
  ProcessingDraftInput,
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
      const imageEntries = await Promise.all(
        evidence.map(
          async (item) =>
            [
              item.evidence_id,
              await services.recoveryRecords.getEvidenceImage(item.evidence_id),
            ] as const,
        ),
      );
      const images = Object.fromEntries(imageEntries) as Record<string, string | null>;
      return { evidence, images };
    },
    enabled: Boolean(recordId),
  });
}

/**
 * Server-driven record pages. Filters are applied by the server and each further page follows
 * the server's cursor; nothing is filtered or paginated in the browser.
 */
export function useRecordPages(filters: Omit<RecoveryRecordListRequest, "cursor">) {
  const services = useServices();
  const role = useRole();
  return useInfiniteQuery({
    queryKey: queryKeys.records.pages(role, JSON.stringify(filters)),
    queryFn: ({ pageParam }) =>
      services.recoveryRecords.listPage({
        ...filters,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.pagination.has_more ? (page.pagination.next_cursor ?? undefined) : undefined,
  });
}

export function useQrCredentials(recordId: string | undefined, enabled = true) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.credentials(recordId ?? "none"),
    queryFn: () => services.recoveryRecords.getQrCredentials(recordId ?? ""),
    enabled: Boolean(recordId) && enabled,
    // Credentials are sensitive: never kept after the screen that showed them is gone.
    gcTime: 0,
  });
}

export function useReissueQrCredentials() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => services.recoveryRecords.reissueQrCredentials(recordId),
    onSuccess: (credentials) =>
      queryClient.setQueryData(queryKeys.records.credentials(credentials.record_id), credentials),
  });
}

export function useAddEvidence() {
  const services = useServices();
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: AddEvidenceInput }) =>
      services.recoveryRecords.addEvidence(recordId, input),
    onSuccess: invalidate,
  });
}

export function useProcessingQueue() {
  const services = useServices();
  return useInfiniteQuery({
    queryKey: queryKeys.records.processingQueue,
    queryFn: ({ pageParam }) =>
      services.processing.listQueue(pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.pagination.has_more ? (page.pagination.next_cursor ?? undefined) : undefined,
  });
}

export function useProcessingDraft(recordId: string) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.processingDraft(recordId),
    queryFn: () => services.processing.getDraft(recordId),
  });
}

export function useSaveProcessingDraft() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: ProcessingDraftInput }) =>
      services.processing.saveDraft(recordId, input),
    onSuccess: (detail) =>
      queryClient.setQueryData(queryKeys.records.processingDraft(detail.record_id), detail),
  });
}

/** Protected evidence images for already-loaded evidence metadata, keyed by evidence ID. */
export function useEvidenceImages(evidence: readonly EvidenceMetadata[] | undefined) {
  const services = useServices();
  const ids = (evidence ?? []).map((item) => item.evidence_id);
  return useQuery({
    queryKey: ["records", "evidence-images", ...ids],
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => [id, await services.recoveryRecords.getEvidenceImage(id)] as const),
        ),
      ) as Record<string, string | null>,
    enabled: evidence !== undefined,
  });
}

/** One server-filtered page of review cases; `cursor` selects the page. */
export function useReviewCases(filters: ReviewQueueFilters) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.reviewCases(JSON.stringify(filters)),
    queryFn: () => services.reviews.listCases(filters),
    placeholderData: (previous) => previous,
  });
}

/** The review case of a record: flags, record, evidence, timeline and earlier decisions. */
export function useReviewCase(recordId: string) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.records.reviewCase(recordId),
    queryFn: () => services.reviews.findCaseForRecord(recordId),
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
