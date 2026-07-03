import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/organization.dart';
import '../../data/repositories/organization_repository.dart';
import '../../data/services/organization_api_service.dart';

final organizationApiServiceProvider = Provider<OrganizationApiService>((ref) {
  return OrganizationApiService(ref.watch(apiClientProvider));
});

final organizationRepositoryProvider = Provider<OrganizationRepository>((ref) {
  return ApiOrganizationRepository(ref.watch(organizationApiServiceProvider));
});

final organizationsListProvider =
    FutureProvider.family<PaginatedOrganizations, OrganizationsQuery>((ref, query) {
  return ref.watch(organizationRepositoryProvider).list(
        page: query.page,
        limit: query.limit,
        search: query.search,
      );
});

class OrganizationsQuery {
  const OrganizationsQuery({
    this.page = 1,
    this.limit = 20,
    this.search,
  });

  final int page;
  final int limit;
  final String? search;

  @override
  bool operator ==(Object other) {
    return other is OrganizationsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.search == search;
  }

  @override
  int get hashCode => Object.hash(page, limit, search);
}
