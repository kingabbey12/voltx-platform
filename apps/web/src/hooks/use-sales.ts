import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activitiesApi,
  companiesApi,
  contactsApi,
  leadsApi,
  opportunitiesApi,
  type Company,
  type Contact,
  type Lead,
  type Opportunity,
} from "@/lib/api/sales";

export function useActivities(query: Parameters<typeof activitiesApi.list>[0] = {}) {
  return useQuery({ queryKey: ["sales", "activities", query], queryFn: () => activitiesApi.list(query) });
}

export function useCompanies(query: Parameters<typeof companiesApi.list>[0] = {}) {
  return useQuery({ queryKey: ["sales", "companies", query], queryFn: () => companiesApi.list(query) });
}

export function useContacts(query: Parameters<typeof contactsApi.list>[0] = {}) {
  return useQuery({ queryKey: ["sales", "contacts", query], queryFn: () => contactsApi.list(query) });
}

export function useLeads(query: Parameters<typeof leadsApi.list>[0] = {}) {
  return useQuery({ queryKey: ["sales", "leads", query], queryFn: () => leadsApi.list(query) });
}

export function useOpportunities(query: Parameters<typeof opportunitiesApi.list>[0] = {}) {
  return useQuery({ queryKey: ["sales", "opportunities", query], queryFn: () => opportunitiesApi.list(query) });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Company> & { name: string }) => companiesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "companies"] }),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "companies"] }),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Contact> & { firstName: string; lastName: string }) =>
      contactsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "contacts"] }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "contacts"] }),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Lead> & { title: string }) => leadsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "leads"] }),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "leads"] }),
  });
}

export function useQualifyLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsApi.qualify(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "leads"] }),
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Opportunity> & { title: string }) => opportunitiesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "opportunities"] }),
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Opportunity> }) =>
      opportunitiesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "opportunities"] }),
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => opportunitiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "opportunities"] }),
  });
}
