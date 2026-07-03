import '../models/organization.dart';
import '../services/organization_api_service.dart';

abstract class OrganizationRepository {
  Future<PaginatedOrganizations> list({
    int page = 1,
    int limit = 20,
    String? search,
  });

  Future<Organization> create({
    required String name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  });

  Future<Organization> update(
    String id, {
    String? name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  });

  Future<Organization> delete(String id);
}

class ApiOrganizationRepository implements OrganizationRepository {
  ApiOrganizationRepository(this._apiService);

  final OrganizationApiService _apiService;

  @override
  Future<PaginatedOrganizations> list({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    try {
      return await _apiService.list(page: page, limit: limit, search: search);
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }

  @override
  Future<Organization> create({
    required String name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  }) async {
    try {
      return await _apiService.create(
        name: name,
        logoUrl: logoUrl,
        industry: industry,
        country: country,
        timezone: timezone,
      );
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }

  @override
  Future<Organization> update(
    String id, {
    String? name,
    String? logoUrl,
    String? industry,
    String? country,
    String? timezone,
  }) async {
    try {
      return await _apiService.update(
        id,
        name: name,
        logoUrl: logoUrl,
        industry: industry,
        country: country,
        timezone: timezone,
      );
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }

  @override
  Future<Organization> delete(String id) async {
    try {
      return await _apiService.delete(id);
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }
}
