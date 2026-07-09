import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/organization_profile.dart';
import '../../data/repositories/organization_repository.dart';
import '../../data/services/organization_api_service.dart';

final organizationApiServiceProvider = Provider<OrganizationApiService>((ref) {
  return OrganizationApiService(ref.watch(apiClientProvider));
});

final organizationRepositoryProvider = Provider<OrganizationRepository>((ref) {
  return ApiOrganizationRepository(ref.watch(organizationApiServiceProvider));
});

final organizationProfileProvider =
    FutureProvider.family<OrganizationProfile, String>((ref, organizationId) {
  return ref.watch(organizationRepositoryProvider).getOrganization(organizationId);
});
