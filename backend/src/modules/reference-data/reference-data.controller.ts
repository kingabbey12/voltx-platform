import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { IndustryGroup } from './data/industries.data';
import { LanguageOption } from './data/languages.data';
import {
  CityOption,
  CountryOption,
  CurrencyOption,
  ReferenceDataService,
  StateOption,
} from './reference-data.service';

/**
 * Global, non-tenant-scoped lookup data (countries/states/cities,
 * currencies, timezones, the industry taxonomy, common languages) — the
 * single source of truth both apps/web and apps/mobile call for the
 * onboarding "Business Information" step, so their dropdowns can never
 * drift apart. Gated behind standard auth like every other endpoint in
 * this API, not because the data is sensitive.
 */
@ApiTags('Reference Data')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('reference')
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List all ISO 3166-1 countries with phone code, currency, timezone' })
  listCountries(): CountryOption[] {
    return this.referenceDataService.listCountries();
  }

  @Get('countries/:iso2/states')
  @ApiOperation({ summary: 'List states/provinces for a country' })
  listStates(@Param('iso2') iso2: string): StateOption[] {
    return this.referenceDataService.listStates(iso2);
  }

  @Get('states/:stateCode/cities')
  @ApiOperation({ summary: 'List cities for a state within a country' })
  listCities(
    @Param('stateCode') stateCode: string,
    @Query('country') country: string,
  ): CityOption[] {
    return this.referenceDataService.listCities(country, stateCode);
  }

  @Get('currencies')
  @ApiOperation({ summary: 'List ISO 4217 currency codes in use by a country' })
  listCurrencies(): CurrencyOption[] {
    return this.referenceDataService.listCurrencies();
  }

  @Get('timezones')
  @ApiOperation({ summary: 'List IANA timezone names' })
  listTimezones(): string[] {
    return this.referenceDataService.listTimezones();
  }

  @Get('industries')
  @ApiOperation({ summary: 'List the business industry taxonomy, grouped by category' })
  listIndustries(): IndustryGroup[] {
    return this.referenceDataService.listIndustries();
  }

  @Get('languages')
  @ApiOperation({ summary: 'List common languages by ISO 639-1 code' })
  listLanguages(): LanguageOption[] {
    return this.referenceDataService.listLanguages();
  }
}
