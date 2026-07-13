enum WebhookEndpointStatus {
  active,
  suspended;

  static WebhookEndpointStatus fromJson(String value) =>
      WebhookEndpointStatus.values.firstWhere((status) => status.name.toUpperCase() == value);
}

class WebhookEndpoint {
  const WebhookEndpoint({
    required this.id,
    required this.url,
    required this.description,
    required this.eventTypes,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WebhookEndpoint.fromJson(Map<String, dynamic> json) => WebhookEndpoint(
        id: json['id'] as String,
        url: json['url'] as String,
        description: json['description'] as String?,
        eventTypes: List<String>.from(json['eventTypes'] as List),
        status: WebhookEndpointStatus.fromJson(json['status'] as String),
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  final String id;
  final String url;
  final String? description;
  final List<String> eventTypes;
  final WebhookEndpointStatus status;
  final String createdAt;
  final String updatedAt;
}

class CreateWebhookEndpointResult extends WebhookEndpoint {
  const CreateWebhookEndpointResult({
    required super.id,
    required super.url,
    required super.description,
    required super.eventTypes,
    required super.status,
    required super.createdAt,
    required super.updatedAt,
    required this.secret,
  });

  factory CreateWebhookEndpointResult.fromJson(Map<String, dynamic> json) => CreateWebhookEndpointResult(
        id: json['id'] as String,
        url: json['url'] as String,
        description: json['description'] as String?,
        eventTypes: List<String>.from(json['eventTypes'] as List),
        status: WebhookEndpointStatus.fromJson(json['status'] as String),
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        secret: json['secret'] as String,
      );

  /// Shown exactly once — never retrievable again.
  final String secret;
}

class RotateWebhookEndpointSecretResult {
  const RotateWebhookEndpointSecretResult(this.secret);

  factory RotateWebhookEndpointSecretResult.fromJson(Map<String, dynamic> json) =>
      RotateWebhookEndpointSecretResult(json['secret'] as String);

  final String secret;
}

enum WebhookDeliveryStatus {
  pending,
  succeeded,
  failed,
  exhausted;

  static WebhookDeliveryStatus fromJson(String value) =>
      WebhookDeliveryStatus.values.firstWhere((status) => status.name.toUpperCase() == value);
}

class WebhookDelivery {
  const WebhookDelivery({
    required this.id,
    required this.eventType,
    required this.payload,
    required this.status,
    required this.responseStatusCode,
    required this.responseBody,
    required this.attemptCount,
    required this.deliveredAt,
    required this.createdAt,
  });

  factory WebhookDelivery.fromJson(Map<String, dynamic> json) => WebhookDelivery(
        id: json['id'] as String,
        eventType: json['eventType'] as String,
        payload: json['payload'],
        status: WebhookDeliveryStatus.fromJson(json['status'] as String),
        responseStatusCode: json['responseStatusCode'] as int?,
        responseBody: json['responseBody'] as String?,
        attemptCount: json['attemptCount'] as int,
        deliveredAt: json['deliveredAt'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String eventType;
  final Object? payload;
  final WebhookDeliveryStatus status;
  final int? responseStatusCode;
  final String? responseBody;
  final int attemptCount;
  final String? deliveredAt;
  final String createdAt;
}
