import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  promisesApi,
  type CreatePromiseInput,
  type PromiseRecord,
  type PromiseStatus,
  type UpdatePromiseInput,
} from "@/lib/api/promises";
import type { PaginatedResult } from "@/lib/api/types";

export function usePromises(query: Parameters<typeof promisesApi.list>[0] = {}) {
  return useQuery({ queryKey: ["promises", "list", query], queryFn: () => promisesApi.list(query) });
}

export function usePromise(id: string) {
  return useQuery({
    queryKey: ["promises", "detail", id],
    queryFn: () => promisesApi.get(id),
    enabled: Boolean(id),
  });
}

export function usePromiseEvents(id: string) {
  return useQuery({
    queryKey: ["promises", "events", id],
    queryFn: () => promisesApi.events(id),
    enabled: Boolean(id),
  });
}

export function useCreatePromise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromiseInput) => promisesApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["promises", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdatePromise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePromiseInput }) =>
      promisesApi.update(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["promises", "detail", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["promises", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

const TRANSITION_ENDPOINT = {
  stand: promisesApi.stand,
  fulfill: promisesApi.fulfill,
  release: promisesApi.release,
  break: promisesApi.break,
} as const;

const TRANSITION_NEXT_STATUS: Record<keyof typeof TRANSITION_ENDPOINT, PromiseStatus> = {
  stand: "STANDING",
  fulfill: "FULFILLED",
  release: "RELEASED",
  break: "BROKEN",
};

/**
 * Status transitions render optimistically: the button's effect (moving to
 * the next status) shows immediately across both the detail view and any
 * list/board the promise appears in, and rolls back to the prior snapshot
 * if the server rejects the transition (e.g. an illegal status change).
 */
export function usePromiseTransition(action: keyof typeof TRANSITION_ENDPOINT) {
  const queryClient = useQueryClient();
  const endpoint = TRANSITION_ENDPOINT[action];
  const nextStatus = TRANSITION_NEXT_STATUS[action];

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => endpoint(id, note),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["promises"] });

      const previousDetail = queryClient.getQueryData<PromiseRecord>(["promises", "detail", id]);
      if (previousDetail) {
        queryClient.setQueryData<PromiseRecord>(["promises", "detail", id], {
          ...previousDetail,
          status: nextStatus,
        });
      }

      const previousLists = queryClient.getQueriesData<PaginatedResult<PromiseRecord>>({
        queryKey: ["promises", "list"],
      });
      previousLists.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData(key, {
          ...data,
          items: data.items.map((promise) =>
            promise.id === id ? { ...promise, status: nextStatus } : promise,
          ),
        });
      });

      return { previousDetail, previousLists };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["promises", "detail", id], context.previousDetail);
      }
      context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["promises", "detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["promises", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["promises", "events", id] });
      void queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useDeletePromise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promisesApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["promises", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}
