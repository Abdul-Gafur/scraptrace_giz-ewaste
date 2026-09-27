"use client";

import type { EwasteCategory, SupportedLanguage } from "@scraptrace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { ModelConfiguration } from "@/services/domain/model-administration";
import type { SafetyCardStatus } from "@/services/domain/safety-content";
import { useServices } from "@/services/service-provider";
import type { SafetyCardApprovalInput, SafetyCardDraftInput } from "@/services/ports/service-ports";

// Safety content ---------------------------------------------------------

export function useSafetyCards() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.safetyCards,
    queryFn: () => services.safetyContent.list(),
  });
}

function useInvalidateSafety() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.safetyCards });
    void queryClient.invalidateQueries({ queryKey: ["safety-guidance"] });
  };
}

export function useCreateSafetyDraft() {
  const services = useServices();
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: (input: SafetyCardDraftInput) => services.safetyContent.createDraft(input),
    onSuccess: invalidate,
  });
}

export function useUpdateSafetyDraft() {
  const services = useServices();
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: Partial<SafetyCardDraftInput> }) =>
      services.safetyContent.updateDraft(cardId, input),
    onSuccess: invalidate,
  });
}

export function useApproveSafetyCard() {
  const services = useServices();
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: (input: SafetyCardApprovalInput) => services.safetyContent.approve(input),
    onSuccess: invalidate,
  });
}

export function useChangeSafetyCardStatus() {
  const services = useServices();
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ cardId, status }: { cardId: string; status: SafetyCardStatus }) =>
      services.safetyContent.changeStatus(cardId, status),
    onSuccess: invalidate,
  });
}

/** The collector-facing guidance, used by the capture screen and the editor preview. */
export function useSafetyGuidance(
  category: EwasteCategory | undefined,
  language: SupportedLanguage,
  enabled = true,
) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.safetyGuidance(category ?? "none", language),
    queryFn: () =>
      services.safetyGuidance.getGuidance({
        category: category as EwasteCategory,
        requested_language: language,
        transformation_mode: "none",
        offline: false,
      }),
    enabled: enabled && Boolean(category),
  });
}

// Model administration ---------------------------------------------------

export function useModelRegistry() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.model.registry,
    queryFn: () => services.modelAdministration.listRegistry(),
    staleTime: 5 * 60_000,
  });
}

export function useModelConfiguration() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.model.configuration,
    queryFn: () => services.modelAdministration.getConfiguration(),
  });
}

export function useSaveModelConfiguration() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (configuration: Omit<ModelConfiguration, "updated_at" | "updated_by">) =>
      services.modelAdministration.saveConfiguration(configuration),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.model.configuration });
    },
  });
}

export function usePredictionFeedback() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.model.feedback,
    queryFn: () => services.modelAdministration.listFeedback(),
  });
}

export function useDecideFeedback() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      feedbackId,
      state,
    }: {
      feedbackId: string;
      state: "approved_for_training_dataset" | "rejected_for_training";
    }) => services.modelAdministration.decideFeedback(feedbackId, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.model.feedback });
    },
  });
}
