import { useQuery } from "@tanstack/react-query";
import { referenceDataApi } from "@/lib/api/reference-data";

// This data is effectively static (ISO country/currency/timezone lists,
// the hand-authored industry taxonomy) — never refetch within a session.
const STATIC_REFERENCE_OPTIONS = {
  staleTime: Infinity,
  gcTime: Infinity,
};

export function useCountries() {
  return useQuery({
    queryKey: ["reference", "countries"],
    queryFn: referenceDataApi.listCountries,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useStatesForCountry(countryIso2: string | undefined) {
  return useQuery({
    queryKey: ["reference", "states", countryIso2],
    queryFn: () => referenceDataApi.listStates(countryIso2 as string),
    enabled: !!countryIso2,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useCitiesForState(countryIso2: string | undefined, stateIsoCode: string | undefined) {
  return useQuery({
    queryKey: ["reference", "cities", countryIso2, stateIsoCode],
    queryFn: () => referenceDataApi.listCities(countryIso2 as string, stateIsoCode as string),
    enabled: !!countryIso2 && !!stateIsoCode,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["reference", "currencies"],
    queryFn: referenceDataApi.listCurrencies,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useTimezones() {
  return useQuery({
    queryKey: ["reference", "timezones"],
    queryFn: referenceDataApi.listTimezones,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useIndustries() {
  return useQuery({
    queryKey: ["reference", "industries"],
    queryFn: referenceDataApi.listIndustries,
    ...STATIC_REFERENCE_OPTIONS,
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: ["reference", "languages"],
    queryFn: referenceDataApi.listLanguages,
    ...STATIC_REFERENCE_OPTIONS,
  });
}
