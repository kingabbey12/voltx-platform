class PaginatedBillingResult<T> {
  const PaginatedBillingResult({
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

  factory PaginatedBillingResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedBillingResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class BillingPlanLimit {
  const BillingPlanLimit({
    required this.featureKey,
    required this.unit,
    required this.limit,
    this.softLimitPercent,
  });

  final String featureKey;
  final String unit;
  /// null = unlimited on this plan.
  final int? limit;
  final int? softLimitPercent;

  factory BillingPlanLimit.fromJson(Map<String, dynamic> json) {
    return BillingPlanLimit(
      featureKey: json['featureKey'] as String,
      unit: json['unit'] as String? ?? 'COUNT',
      limit: json['limit'] as int?,
      softLimitPercent: json['softLimitPercent'] as int?,
    );
  }
}

class BillingPlan {
  const BillingPlan({
    required this.id,
    required this.key,
    required this.name,
    required this.sortOrder,
    required this.trialDays,
    this.description,
    this.priceMonthlyUsd,
    this.priceYearlyUsd,
    this.limits,
  });

  final String id;
  final String key;
  final String name;
  final String? description;
  final num? priceMonthlyUsd;
  final num? priceYearlyUsd;
  final int sortOrder;
  final int trialDays;
  final List<BillingPlanLimit>? limits;

  factory BillingPlan.fromJson(Map<String, dynamic> json) {
    return BillingPlan(
      id: json['id'] as String,
      key: json['key'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      priceMonthlyUsd: json['priceMonthlyUsd'] as num?,
      priceYearlyUsd: json['priceYearlyUsd'] as num?,
      sortOrder: json['sortOrder'] as int? ?? 0,
      trialDays: json['trialDays'] as int? ?? 0,
      limits: (json['limits'] as List<dynamic>?)
          ?.map((item) => BillingPlanLimit.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }
}

class BillingSubscription {
  const BillingSubscription({
    required this.id,
    required this.planId,
    required this.status,
    required this.seats,
    required this.currentPeriodStart,
    required this.currentPeriodEnd,
    required this.cancelAtPeriodEnd,
    this.stripeSubscriptionId,
    this.trialStart,
    this.trialEnd,
    this.canceledAt,
  });

  final String id;
  final String planId;
  final String? stripeSubscriptionId;
  final String status;
  final int seats;
  final String currentPeriodStart;
  final String currentPeriodEnd;
  final String? trialStart;
  final String? trialEnd;
  final bool cancelAtPeriodEnd;
  final String? canceledAt;

  factory BillingSubscription.fromJson(Map<String, dynamic> json) {
    return BillingSubscription(
      id: json['id'] as String,
      planId: json['planId'] as String,
      stripeSubscriptionId: json['stripeSubscriptionId'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      seats: json['seats'] as int? ?? 1,
      currentPeriodStart: json['currentPeriodStart'] as String,
      currentPeriodEnd: json['currentPeriodEnd'] as String,
      trialStart: json['trialStart'] as String?,
      trialEnd: json['trialEnd'] as String?,
      cancelAtPeriodEnd: json['cancelAtPeriodEnd'] as bool? ?? false,
      canceledAt: json['canceledAt'] as String?,
    );
  }
}

class BillingFeatureUsage {
  const BillingFeatureUsage({
    required this.featureKey,
    required this.currentUsage,
    required this.unit,
    this.limit,
    this.remaining,
  });

  final String featureKey;
  final int currentUsage;
  /// null = unlimited on this plan.
  final int? limit;
  final int? remaining;
  final String unit;

  factory BillingFeatureUsage.fromJson(Map<String, dynamic> json) {
    return BillingFeatureUsage(
      featureKey: json['featureKey'] as String,
      currentUsage: json['currentUsage'] as int? ?? 0,
      limit: json['limit'] as int?,
      remaining: json['remaining'] as int?,
      unit: json['unit'] as String? ?? 'COUNT',
    );
  }
}

class BillingInvoice {
  const BillingInvoice({
    required this.id,
    required this.status,
    required this.amountDue,
    required this.amountPaid,
    required this.amountRemaining,
    required this.currency,
    required this.createdAt,
    this.stripeInvoiceId,
    this.dueDate,
    this.paidAt,
    this.hostedInvoiceUrl,
    this.pdfUrl,
  });

  final String id;
  final String? stripeInvoiceId;
  final String status;
  final num amountDue;
  final num amountPaid;
  final num amountRemaining;
  final String currency;
  final String? dueDate;
  final String? paidAt;
  final String? hostedInvoiceUrl;
  final String? pdfUrl;
  final String createdAt;

  factory BillingInvoice.fromJson(Map<String, dynamic> json) {
    return BillingInvoice(
      id: json['id'] as String,
      stripeInvoiceId: json['stripeInvoiceId'] as String?,
      status: json['status'] as String? ?? 'DRAFT',
      amountDue: json['amountDue'] as num? ?? 0,
      amountPaid: json['amountPaid'] as num? ?? 0,
      amountRemaining: json['amountRemaining'] as num? ?? 0,
      currency: json['currency'] as String? ?? 'usd',
      dueDate: json['dueDate'] as String?,
      paidAt: json['paidAt'] as String?,
      hostedInvoiceUrl: json['hostedInvoiceUrl'] as String?,
      pdfUrl: json['pdfUrl'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }
}

class BillingPaymentMethod {
  const BillingPaymentMethod({
    required this.id,
    required this.type,
    required this.isDefault,
    this.brand,
    this.last4,
    this.expMonth,
    this.expYear,
  });

  final String id;
  final String type;
  final String? brand;
  final String? last4;
  final int? expMonth;
  final int? expYear;
  final bool isDefault;

  factory BillingPaymentMethod.fromJson(Map<String, dynamic> json) {
    return BillingPaymentMethod(
      id: json['id'] as String,
      type: json['type'] as String? ?? 'CARD',
      brand: json['brand'] as String?,
      last4: json['last4'] as String?,
      expMonth: json['expMonth'] as int?,
      expYear: json['expYear'] as int?,
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }
}

class BillingHostedSession {
  const BillingHostedSession({required this.id, required this.url});

  final String id;
  final String url;

  factory BillingHostedSession.fromJson(Map<String, dynamic> json) {
    return BillingHostedSession(
      id: json['id'] as String,
      url: json['url'] as String,
    );
  }
}
