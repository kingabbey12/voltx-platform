import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../constants/organization_constants.dart';
import '../models/organization.dart';

class OrganizationApiService {
  OrganizationApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedOrganizations> list({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    return _apiClient.get(
      OrganizationApiPaths.organizations,
      queryParameters: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
      },
      fromJson: PaginatedOrganizations.fromJson,
    );
  }

  Future<Organization> create({
    required String name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  }) async {
    return _apiClient.post(
      OrganizationApiPaths.organizations,
      data: {
        'name': name,
        'logoUrl': ?logoUrl,
        'industry': ?industry,
        'country': ?country,
        'timezone': ?timezone,
      },
      fromJson: Organization.fromJson,
    );
  }

  Future<Organization> update(
    String id, {
    String? name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  }) async {
    return _apiClient.patch(
      '${OrganizationApiPaths.organizations}/$id',
      data: {
        'name': ?name,
        'logoUrl': ?logoUrl,
        'industry': ?industry,
        'country': ?country,
        'timezone': ?timezone,
      },
      fromJson: Organization.fromJson,
    );
  }

  Future<Organization> delete(String id) async {
    return _apiClient.delete(
      '${OrganizationApiPaths.organizations}/$id',
      fromJson: Organization.fromJson,
    );
  }
}

OrganizationException mapToOrganizationException(Object error) {
  if (error is OrganizationException) {
    return error;
  }
  if (error is NetworkException) {
    return OrganizationException(error.message);
  }
  return const OrganizationException('Unable to complete organization request.');
}
