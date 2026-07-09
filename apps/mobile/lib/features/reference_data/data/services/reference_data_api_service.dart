import '../../../../core/network/api_client.dart';
import '../models/reference_data_models.dart';

class ReferenceDataApiService {
  ReferenceDataApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<List<CountryOption>> getCountries() {
    return _apiClient.getListPlain(
      '/reference/countries',
      fromJson: CountryOption.fromJson,
    );
  }

  Future<List<StateOption>> getStates(String countryIso2) {
    return _apiClient.getListPlain(
      '/reference/countries/$countryIso2/states',
      fromJson: StateOption.fromJson,
    );
  }

  Future<List<CityOption>> getCities(String countryIso2, String stateIsoCode) {
    return _apiClient.getListPlain(
      '/reference/states/$stateIsoCode/cities',
      fromJson: CityOption.fromJson,
      queryParameters: {'country': countryIso2},
    );
  }

  Future<List<CurrencyOption>> getCurrencies() {
    return _apiClient.getListPlain(
      '/reference/currencies',
      fromJson: CurrencyOption.fromJson,
    );
  }

  Future<List<String>> getTimezones() {
    return _apiClient.getStringList('/reference/timezones');
  }

  Future<List<IndustryGroup>> getIndustries() {
    return _apiClient.getListPlain(
      '/reference/industries',
      fromJson: IndustryGroup.fromJson,
    );
  }

  Future<List<LanguageOption>> getLanguages() {
    return _apiClient.getListPlain(
      '/reference/languages',
      fromJson: LanguageOption.fromJson,
    );
  }
}
