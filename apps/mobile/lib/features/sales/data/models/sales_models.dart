class SalesPageQuery {
  const SalesPageQuery({
    this.page = 1,
    this.limit = 20,
    this.search,
    this.filters = const {},
  });

  final int page;
  final int limit;
  final String? search;
  final Map<String, Object?> filters;

  Map<String, dynamic> toQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (search != null && search!.trim().isNotEmpty) 'search': search!.trim(),
      ...filters,
    };
  }

  @override
  bool operator ==(Object other) {
    if (other is! SalesPageQuery) {
      return false;
    }
    return other.page == page &&
        other.limit == limit &&
        other.search == search &&
        _mapsEqual(other.filters, filters);
  }

  @override
  int get hashCode {
    final sortedKeys = filters.keys.toList()..sort();
    final filterHash = Object.hashAll(
      sortedKeys.map((key) => Object.hash(key, filters[key])),
    );
    return Object.hash(page, limit, search, filterHash);
  }
}

bool _mapsEqual(Map<String, Object?> a, Map<String, Object?> b) {
  if (a.length != b.length) {
    return false;
  }
  for (final entry in a.entries) {
    if (b[entry.key] != entry.value) {
      return false;
    }
  }
  return true;
}

class PaginatedSalesResult<T> {
  const PaginatedSalesResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedSalesResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedSalesResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class SalesCompany {
  const SalesCompany({
    required this.id,
    required this.name,
    required this.status,
    this.domain,
    this.website,
    this.industry,
    this.notes,
    this.metadata = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory SalesCompany.fromJson(Map<String, dynamic> json) {
    return SalesCompany(
      id: json['id'] as String,
      name: json['name'] as String,
      status: json['status'] as String? ?? 'PROSPECT',
      domain: json['domain'] as String?,
      website: json['website'] as String?,
      industry: json['industry'] as String?,
      notes: json['notes'] as String?,
      metadata: _map(json['metadata']),
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String name;
  final String status;
  final String? domain;
  final String? website;
  final String? industry;
  final String? notes;
  final Map<String, dynamic> metadata;
  final String? createdAt;
  final String? updatedAt;
}

class SalesContact {
  const SalesContact({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.companyId,
    this.email,
    this.phone,
    this.jobTitle,
    this.notes,
    this.metadata = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory SalesContact.fromJson(Map<String, dynamic> json) {
    return SalesContact(
      id: json['id'] as String,
      companyId: json['companyId'] as String?,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      jobTitle: json['jobTitle'] as String?,
      notes: json['notes'] as String?,
      metadata: _map(json['metadata']),
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String? companyId;
  final String firstName;
  final String lastName;
  final String? email;
  final String? phone;
  final String? jobTitle;
  final String? notes;
  final Map<String, dynamic> metadata;
  final String? createdAt;
  final String? updatedAt;

  String get fullName => '$firstName $lastName'.trim();
}

class SalesLead {
  const SalesLead({
    required this.id,
    required this.title,
    required this.status,
    this.companyId,
    this.contactId,
    this.source,
    this.qualificationScore,
    this.qualificationSummary,
    this.notes,
    this.metadata = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory SalesLead.fromJson(Map<String, dynamic> json) {
    return SalesLead(
      id: json['id'] as String,
      companyId: json['companyId'] as String?,
      contactId: json['contactId'] as String?,
      title: json['title'] as String,
      source: json['source'] as String?,
      status: json['status'] as String? ?? 'NEW',
      qualificationScore: json['qualificationScore'] as int?,
      qualificationSummary: json['qualificationSummary'] as String?,
      notes: json['notes'] as String?,
      metadata: _map(json['metadata']),
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String? companyId;
  final String? contactId;
  final String title;
  final String? source;
  final String status;
  final int? qualificationScore;
  final String? qualificationSummary;
  final String? notes;
  final Map<String, dynamic> metadata;
  final String? createdAt;
  final String? updatedAt;
}

class SalesOpportunity {
  const SalesOpportunity({
    required this.id,
    required this.title,
    required this.stage,
    required this.currency,
    required this.probability,
    this.companyId,
    this.contactId,
    this.leadId,
    this.amount,
    this.expectedCloseAt,
    this.insights,
    this.nextBestAction,
    this.notes,
    this.metadata = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory SalesOpportunity.fromJson(Map<String, dynamic> json) {
    return SalesOpportunity(
      id: json['id'] as String,
      companyId: json['companyId'] as String?,
      contactId: json['contactId'] as String?,
      leadId: json['leadId'] as String?,
      title: json['title'] as String,
      stage: json['stage'] as String? ?? 'DISCOVERY',
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      probability: json['probability'] as int? ?? 0,
      expectedCloseAt: json['expectedCloseAt'] as String?,
      insights: json['insights'] as String?,
      nextBestAction: json['nextBestAction'] as String?,
      notes: json['notes'] as String?,
      metadata: _map(json['metadata']),
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String? companyId;
  final String? contactId;
  final String? leadId;
  final String title;
  final String stage;
  final double? amount;
  final String currency;
  final int probability;
  final String? expectedCloseAt;
  final String? insights;
  final String? nextBestAction;
  final String? notes;
  final Map<String, dynamic> metadata;
  final String? createdAt;
  final String? updatedAt;
}

class SalesActivity {
  const SalesActivity({
    required this.id,
    required this.type,
    required this.subject,
    required this.completed,
    this.companyId,
    this.contactId,
    this.leadId,
    this.opportunityId,
    this.description,
    this.occurredAt,
    this.dueAt,
    this.meetingSummary,
    this.metadata = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory SalesActivity.fromJson(Map<String, dynamic> json) {
    return SalesActivity(
      id: json['id'] as String,
      companyId: json['companyId'] as String?,
      contactId: json['contactId'] as String?,
      leadId: json['leadId'] as String?,
      opportunityId: json['opportunityId'] as String?,
      type: json['type'] as String? ?? 'TASK',
      subject: json['subject'] as String,
      description: json['description'] as String?,
      occurredAt: json['occurredAt'] as String?,
      dueAt: json['dueAt'] as String?,
      completed: json['completed'] as bool? ?? false,
      meetingSummary: json['meetingSummary'] as String?,
      metadata: _map(json['metadata']),
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String? companyId;
  final String? contactId;
  final String? leadId;
  final String? opportunityId;
  final String type;
  final String subject;
  final String? description;
  final String? occurredAt;
  final String? dueAt;
  final bool completed;
  final String? meetingSummary;
  final Map<String, dynamic> metadata;
  final String? createdAt;
  final String? updatedAt;
}

class SalesAiActionResult {
  const SalesAiActionResult({
    required this.conversationId,
    required this.agentRunId,
    required this.outputText,
  });

  factory SalesAiActionResult.fromJson(Map<String, dynamic> json) {
    return SalesAiActionResult(
      conversationId: json['conversationId'] as String,
      agentRunId: json['agentRunId'] as String,
      outputText: json['outputText'] as String? ?? '',
    );
  }

  final String conversationId;
  final String agentRunId;
  final String outputText;
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return const {};
}

const salesLeadStatuses = ['NEW', 'QUALIFIED', 'NURTURING', 'DISQUALIFIED', 'CONVERTED'];
const salesOpportunityStages = [
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];
const salesActivityTypes = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'];
