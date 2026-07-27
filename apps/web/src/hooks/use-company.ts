import { useQuery } from "@tanstack/react-query";
import { companyApi } from "@/lib/api/company";

export function useCompanyHome() {
  return useQuery({ queryKey: ["company", "home"], queryFn: () => companyApi.getHome() });
}

export function useCompanyTimeline(recordType: string, recordId: string) {
  return useQuery({
    queryKey: ["company", "timeline", recordType, recordId],
    queryFn: () => companyApi.getTimeline(recordType, recordId),
    enabled: Boolean(recordType && recordId),
  });
}
