import { Injectable, NotFoundException } from '@nestjs/common';
import { City, Country, State } from 'country-state-city';
import { INDUSTRY_TAXONOMY, IndustryGroup } from './data/industries.data';
import { LANGUAGE_OPTIONS, LanguageOption } from './data/languages.data';

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

@Injectable()
export class ReferenceDataService {
  listCountries(): CountryOption[] {
    return Country.getAllCountries()
      .map((country) => ({
        isoCode: country.isoCode,
        name: country.name,
        phoneCode: country.phonecode.startsWith('+') ? country.phonecode : `+${country.phonecode}`,
        currency: country.currency,
        timezone: country.timezones?.[0]?.zoneName ?? null,
        flag: country.flag,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listStates(countryIso2: string): StateOption[] {
    const country = Country.getCountryByCode(countryIso2.toUpperCase());
    if (!country) {
      throw new NotFoundException(`Unknown country code "${countryIso2}"`);
    }

    return State.getStatesOfCountry(countryIso2.toUpperCase())
      .map((state) => ({ isoCode: state.isoCode, name: state.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listCities(countryIso2: string, stateIsoCode: string): CityOption[] {
    return City.getCitiesOfState(countryIso2.toUpperCase(), stateIsoCode.toUpperCase())
      .map((city) => ({ name: city.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listCurrencies(): CurrencyOption[] {
    const seen = new Map<string, CurrencyOption>();
    for (const country of Country.getAllCountries()) {
      if (!seen.has(country.currency)) {
        seen.set(country.currency, { code: country.currency, countryName: country.name });
      }
    }
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  listTimezones(): string[] {
    return Intl.supportedValuesOf('timeZone').sort((a, b) => a.localeCompare(b));
  }

  listIndustries(): IndustryGroup[] {
    return INDUSTRY_TAXONOMY;
  }

  listLanguages(): LanguageOption[] {
    return LANGUAGE_OPTIONS;
  }
}
