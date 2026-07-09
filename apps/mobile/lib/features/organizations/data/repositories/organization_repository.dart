import '../../../../core/network/network_exception.dart';
import '../models/organization_profile.dart';
import '../services/organization_api_service.dart';

abstract class OrganizationRepository {
  Future<OrganizationProfile> getOrganization(String organizationId);

  Future<OrganizationProfile> updateOrganization(
    String organizationId, {
    String? name,
    String? email,
    String? website,
    String? industry,
    String? country,
    String? state,
    String? city,
    String? companySize,
    List<String>? primaryGoals,
    String? currency,
    String? language,
    String? phone,
    String? timezone,
  });

  Future<OrganizationProfile> completeOnboarding(String organizationId);
}

class ApiOrganizationRepository implements OrganizationRepository {
  ApiOrganizationRepository(this._apiService);

  final OrganizationApiService _apiService;

  @override
  Future<OrganizationProfile> getOrganization(String organizationId) async {
    try {
      return await _apiService.getOrganization(organizationId);
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }

  @override
  Future<OrganizationProfile> updateOrganization(
    String organizationId, {
    String? name,
    String? email,
    String? website,
    String? industry,
    String? country,
    String? state,
    String? city,
    String? companySize,
    List<String>? primaryGoals,
    String? currency,
    String? language,
    String? phone,
    String? timezone,
  }) async {
    try {
      return await _apiService.updateOrganization(
        organizationId,
        name: name,
        email: email,
        website: website,
        industry: industry,
        country: country,
        state: state,
        city: city,
        companySize: companySize,
        primaryGoals: primaryGoals,
        currency: currency,
        language: language,
        phone: phone,
        timezone: timezone,
      );
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }

  @override
  Future<OrganizationProfile> completeOnboarding(String organizationId) async {
    try {
      return await _apiService.completeOnboarding(organizationId);
    } catch (error) {
      throw mapToOrganizationException(error);
    }
  }
}

OrganizationException mapToOrganizationException(Object error) {
  if (error is OrganizationException) {
    return error;
  }
  if (error is NetworkException) {
    return OrganizationException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const OrganizationException('Unable to complete this organization request.');
}

class OrganizationException implements Exception {
  const OrganizationException(this.message);

  final String message;

  @override
  String toString() => message;
}
