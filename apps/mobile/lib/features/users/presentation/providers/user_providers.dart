import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/user_profile.dart';
import '../../data/repositories/user_repository.dart';
import '../../data/services/user_api_service.dart';

final userApiServiceProvider = Provider<UserApiService>((ref) {
  return UserApiService(ref.watch(apiClientProvider));
});

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return ApiUserRepository(ref.watch(userApiServiceProvider));
});

final currentUserProfileProvider = FutureProvider<UserProfile>((ref) {
  return ref.watch(userRepositoryProvider).getCurrentUser();
});
