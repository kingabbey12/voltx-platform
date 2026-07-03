import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/env_config.dart';
import '../storage/token_storage.dart';
import 'api_client.dart';
import 'dio_client.dart';

final envConfigProvider = Provider<EnvConfig>(
  (ref) => EnvConfig.fromEnvironment(),
);

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage();
});

final refreshDioProvider = Provider<Dio>((ref) {
  final env = ref.watch(envConfigProvider);
  return DioClient(env).create();
});

final dioProvider = Provider<Dio>((ref) {
  final env = ref.watch(envConfigProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);
  final refreshDio = ref.watch(refreshDioProvider);

  return DioClient(
    env,
    tokenStorage: tokenStorage,
    refreshDio: refreshDio,
  ).create(authenticated: true);
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(dioProvider));
});
