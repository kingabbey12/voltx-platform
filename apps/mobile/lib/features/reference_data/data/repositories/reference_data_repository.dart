import '../models/reference_data_models.dart';
import '../reference_data_cache.dart';
import '../services/reference_data_api_service.dart';

/// Cache-first, network-refresh, stale-cache-on-failure — this is what
/// makes the cache genuinely useful offline rather than just a
/// refetch-avoidance optimization: a network failure with *any* prior
/// cache (even expired) still returns data instead of an error.
class ReferenceDataRepository {
  ReferenceDataRepository(this._api, this._cache);

  final ReferenceDataApiService _api;
  final ReferenceDataCache _cache;

  Future<List<CountryOption>> getCountries() => _fetch(
        key: 'ref_countries',
        fromJson: CountryOption.fromJson,
        toJson: (c) => c.toJson(),
        fetch: _api.getCountries,
      );

  Future<List<StateOption>> getStates(String countryIso2) => _fetch(
        key: 'ref_states_$countryIso2',
        fromJson: StateOption.fromJson,
        toJson: (s) => s.toJson(),
        fetch: () => _api.getStates(countryIso2),
      );

  Future<List<CityOption>> getCities(String countryIso2, String stateIsoCode) => _fetch(
        key: 'ref_cities_${countryIso2}_$stateIsoCode',
        fromJson: CityOption.fromJson,
        toJson: (c) => c.toJson(),
        fetch: () => _api.getCities(countryIso2, stateIsoCode),
      );

  Future<List<CurrencyOption>> getCurrencies() => _fetch(
        key: 'ref_currencies',
        fromJson: CurrencyOption.fromJson,
        toJson: (c) => c.toJson(),
        fetch: _api.getCurrencies,
      );

  Future<List<IndustryGroup>> getIndustries() => _fetch(
        key: 'ref_industries',
        fromJson: IndustryGroup.fromJson,
        toJson: (i) => i.toJson(),
        fetch: _api.getIndustries,
      );

  Future<List<LanguageOption>> getLanguages() => _fetch(
        key: 'ref_languages',
        fromJson: LanguageOption.fromJson,
        toJson: (l) => l.toJson(),
        fetch: _api.getLanguages,
      );

  Future<List<String>> getTimezones() async {
    const key = 'ref_timezones';
    final fresh = await _cache.readStrings(key);
    if (fresh != null) return fresh;

    try {
      final result = await _api.getTimezones();
      await _cache.writeStrings(key, result);
      return result;
    } catch (error) {
      final stale = await _cache.readStaleStrings(key);
      if (stale != null) return stale;
      rethrow;
    }
  }

  Future<List<T>> _fetch<T>({
    required String key,
    required T Function(Map<String, dynamic> json) fromJson,
    required Map<String, dynamic> Function(T item) toJson,
    required Future<List<T>> Function() fetch,
  }) async {
    final fresh = await _cache.read(key, fromJson);
    if (fresh != null) return fresh;

    try {
      final result = await fetch();
      await _cache.write(key, result, toJson);
      return result;
    } catch (error) {
      final stale = await _cache.readStale(key, fromJson);
      if (stale != null) return stale;
      rethrow;
    }
  }
}
