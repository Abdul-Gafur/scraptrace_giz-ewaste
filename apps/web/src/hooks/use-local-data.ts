"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { useServices } from "@/services/service-provider";

export function useLocalDataSummary() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.localData,
    queryFn: () => services.localData.summary(),
  });
}

export function useClearLocalData() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.localData.clear(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
