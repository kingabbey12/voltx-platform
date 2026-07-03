/// Organization returned by the API.
class Organization {
  const Organization({
    required this.id,
    required this.name,
    required this.slug,
    required this.timezone,
    required this.status,
    this.logoUrl,
    this.industry,
    this.country,
    this.createdAt,
    this.updatedAt,
  });

  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      timezone: json['timezone'] as String? ?? 'UTC',
      status: json['status'] as String? ?? 'ACTIVE',
      logoUrl: json['logoUrl'] as String?,
      industry: json['industry'] as String?,
      country: json['country'] as String?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String timezone;
  final String status;
  final String? logoUrl;
  final String? industry;
  final String? country;
  final String? createdAt;
  final String? updatedAt;
}

class PaginatedOrganizations {
  const PaginatedOrganizations({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory PaginatedOrganizations.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => Organization.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();

    return PaginatedOrganizations(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }

  final List<Organization> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;
}

class OrganizationException implements Exception {
  const OrganizationException(this.message);

  final String message;

  @override
  String toString() => message;
}
