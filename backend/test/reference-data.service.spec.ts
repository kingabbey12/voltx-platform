import { NotFoundException } from '@nestjs/common';
import { ReferenceDataService } from '../src/modules/reference-data/reference-data.service';

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;

  beforeEach(() => {
    service = new ReferenceDataService();
  });

  describe('listCountries', () => {
    it('returns every country sorted by name, with phone codes normalized to a leading +', () => {
      const countries = service.listCountries();

      expect(countries.length).toBeGreaterThan(190);
      const names = countries.map((c) => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      for (const country of countries) {
        expect(country.phoneCode.startsWith('+')).toBe(true);
      }

      const us = countries.find((c) => c.isoCode === 'US');
      expect(us).toMatchObject({ name: 'United States', currency: 'USD' });
    });
  });

  describe('listStates', () => {
    it('returns states for a valid country code, sorted by name', () => {
      const states = service.listStates('us');

      expect(states.length).toBeGreaterThan(40);
      const names = states.map((s) => s.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(states.some((s) => s.name === 'California')).toBe(true);
    });

    it('is case-insensitive on the country code', () => {
      expect(service.listStates('US')).toEqual(service.listStates('us'));
    });

    it('throws NotFoundException for an unknown country code', () => {
      expect(() => service.listStates('ZZ')).toThrow(NotFoundException);
    });
  });

  describe('listCities', () => {
    it('returns cities for a valid country/state pair, sorted by name', () => {
      const cities = service.listCities('US', 'CA');

      expect(cities.length).toBeGreaterThan(0);
      const names = cities.map((c) => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('returns an empty array for an unknown state rather than throwing', () => {
      expect(service.listCities('US', 'ZZ')).toEqual([]);
    });
  });

  describe('listCurrencies', () => {
    it('returns one entry per distinct currency code, sorted by code', () => {
      const currencies = service.listCurrencies();

      const codes = currencies.map((c) => c.code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
      expect(currencies.some((c) => c.code === 'USD')).toBe(true);
    });
  });

  describe('listTimezones', () => {
    it('returns IANA timezone names sorted alphabetically', () => {
      const timezones = service.listTimezones();

      expect(timezones).toContain('America/New_York');
      expect(timezones).toEqual([...timezones].sort((a, b) => a.localeCompare(b)));
    });
  });

  describe('listIndustries', () => {
    it('returns the grouped industry taxonomy with non-empty categories', () => {
      const industries = service.listIndustries();

      expect(industries.length).toBeGreaterThan(0);
      for (const group of industries) {
        expect(group.category.length).toBeGreaterThan(0);
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });

  describe('listLanguages', () => {
    it('returns languages including English by ISO 639-1 code', () => {
      const languages = service.listLanguages();

      expect(languages).toContainEqual({ code: 'en', name: 'English' });
    });
  });
});
