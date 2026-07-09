/// Full organization profile, mirroring the backend's OrganizationResponseDto.
///
/// email/website/state/city/companySize/primaryGoals/currency/language/phone
/// were added for schema parity with the web onboarding rebuild — this
/// screen doesn't yet expose UI for editing them, but they round-trip
/// correctly so data saved from web isn't silently dropped when a mobile
/// client reads or re-saves the profile.
class OrganizationProfile {
  const OrganizationProfile({
    required this.id,
    required this.name,
    required this.slug,
    required this.timezone,
    required this.status,
    required this.onboardingCompleted,
    this.logoUrl,
    this.email,
    this.website,
    this.industry,
    this.country,
    this.state,
    this.city,
    this.companySize,
    this.primaryGoals = const [],
    this.currency,
    this.language,
    this.phone,
  });

  factory OrganizationProfile.fromJson(Map<String, dynamic> json) {
    return OrganizationProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      logoUrl: json['logoUrl'] as String?,
      email: json['email'] as String?,
      website: json['website'] as String?,
      industry: json['industry'] as String?,
      country: json['country'] as String?,
      state: json['state'] as String?,
      city: json['city'] as String?,
      companySize: json['companySize'] as String?,
      primaryGoals: (json['primaryGoals'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      currency: json['currency'] as String?,
      language: json['language'] as String?,
      phone: json['phone'] as String?,
      timezone: json['timezone'] as String? ?? 'UTC',
      status: json['status'] as String? ?? 'ACTIVE',
      onboardingCompleted: json['onboardingCompletedAt'] != null,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? logoUrl;
  final String? email;
  final String? website;
  final String? industry;
  final String? country;
  final String? state;
  final String? city;
  final String? companySize;
  final List<String> primaryGoals;
  final String? currency;
  final String? language;
  final String? phone;
  final String timezone;
  final String status;
  final bool onboardingCompleted;
}
