import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/reference_data_models.dart';
import '../../data/reference_data_cache.dart';
import '../../data/repositories/reference_data_repository.dart';
import '../../data/services/reference_data_api_service.dart';

final sharedPreferencesProvider = FutureProvider<SharedPreferences>((ref) {
  return SharedPreferences.getInstance();
});

final referenceDataCacheProvider = Provider<ReferenceDataCache>((ref) {
  return ReferenceDataCache(ref.watch(sharedPreferencesProvider.future));
});

final referenceDataApiServiceProvider = Provider<ReferenceDataApiService>((ref) {
  return ReferenceDataApiService(ref.watch(apiClientProvider));
});

final referenceDataRepositoryProvider = Provider<ReferenceDataRepository>((ref) {
  return ReferenceDataRepository(
    ref.watch(referenceDataApiServiceProvider),
    ref.watch(referenceDataCacheProvider),
  );
});

final countriesProvider = FutureProvider.autoDispose<List<CountryOption>>((ref) {
  return ref.watch(referenceDataRepositoryProvider).getCountries();
});

final industriesProvider = FutureProvider.autoDispose<List<IndustryGroup>>((ref) {
  return ref.watch(referenceDataRepositoryProvider).getIndustries();
});

final currenciesProvider = FutureProvider.autoDispose<List<CurrencyOption>>((ref) {
  return ref.watch(referenceDataRepositoryProvider).getCurrencies();
});

final timezonesProvider = FutureProvider.autoDispose<List<String>>((ref) {
  return ref.watch(referenceDataRepositoryProvider).getTimezones();
});

final languagesProvider = FutureProvider.autoDispose<List<LanguageOption>>((ref) {
  return ref.watch(referenceDataRepositoryProvider).getLanguages();
});

final statesForCountryProvider =
    FutureProvider.autoDispose.family<List<StateOption>, String>((ref, countryIso2) {
  return ref.watch(referenceDataRepositoryProvider).getStates(countryIso2);
});

typedef CountryStateKey = ({String country, String state});

final citiesForStateProvider =
    FutureProvider.autoDispose.family<List<CityOption>, CountryStateKey>((ref, key) {
  return ref.watch(referenceDataRepositoryProvider).getCities(key.country, key.state);
});
