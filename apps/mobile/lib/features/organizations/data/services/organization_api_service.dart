import '../../../../core/network/api_client.dart';
import '../models/organization_profile.dart';

class OrganizationApiService {
  OrganizationApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<OrganizationProfile> getOrganization(String organizationId) {
    return _apiClient.get(
      '/organizations/$organizationId',
      fromJson: OrganizationProfile.fromJson,
    );
  }

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
  }) {
    return _apiClient.patch(
      '/organizations/$organizationId',
      data: {
        'name': ?name,
        'email': ?email,
        'website': ?website,
        'industry': ?industry,
        'country': ?country,
        'state': ?state,
        'city': ?city,
        'companySize': ?companySize,
        'primaryGoals': ?primaryGoals,
        'currency': ?currency,
        'language': ?language,
        'phone': ?phone,
        'timezone': ?timezone,
      },
      fromJson: OrganizationProfile.fromJson,
    );
  }

  Future<OrganizationProfile> completeOnboarding(String organizationId) {
    return _apiClient.post(
      '/organizations/$organizationId/complete-onboarding',
      fromJson: OrganizationProfile.fromJson,
    );
  }
}
