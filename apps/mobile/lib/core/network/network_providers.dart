import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/env_config.dart';
import 'dio_client.dart';

final envConfigProvider = Provider<EnvConfig>(
  (ref) => EnvConfig.fromEnvironment(),
);

final dioProvider = Provider<Dio>((ref) {
  final env = ref.watch(envConfigProvider);
  return DioClient(env).create();
});
