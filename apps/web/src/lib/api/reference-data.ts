import { apiClient } from "./client";

export interface CountryOption {
  isoCode: string;
  name: string;
  phoneCode: string;
  currency: string;
  timezone: string | null;
  flag: string;
}

export interface StateOption {
  isoCode: string;
  name: string;
}

export interface CityOption {
  name: string;
}

export interface CurrencyOption {
  code: string;
  countryName: string;
}

export interface IndustryGroup {
  category: string;
  items: string[];
}

export interface LanguageOption {
  code: string;
  name: string;
}

export const referenceDataApi = {
  listCountries: () => apiClient.get<CountryOption[]>("/reference/countries"),

  listStates: (countryIso2: string) =>
    apiClient.get<StateOption[]>(`/reference/countries/${countryIso2}/states`),

  listCities: (countryIso2: string, stateIsoCode: string) =>
    apiClient.get<CityOption[]>(`/reference/states/${stateIsoCode}/cities`, {
      query: { country: countryIso2 },
    }),

  listCurrencies: () => apiClient.get<CurrencyOption[]>("/reference/currencies"),

  listTimezones: () => apiClient.get<string[]>("/reference/timezones"),

  listIndustries: () => apiClient.get<IndustryGroup[]>("/reference/industries"),

  listLanguages: () => apiClient.get<LanguageOption[]>("/reference/languages"),
};
