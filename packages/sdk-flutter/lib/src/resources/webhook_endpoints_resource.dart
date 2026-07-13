import '../models/webhook_endpoint.dart';
import '../voltx_client.dart';

class WebhookEndpointsResource {
  WebhookEndpointsResource(this._client);
  final VoltxClient _client;

  Future<List<WebhookEndpoint>> list(String organizationId) => _client.requestList(
        '/organizations/$organizationId/webhook-endpoints',
        fromJson: WebhookEndpoint.fromJson,
      );

  Future<CreateWebhookEndpointResult> create(
    String organizationId, {
    required String url,
    required List<String> eventTypes,
    String? description,
  }) =>
      _client.request(
        '/organizations/$organizationId/webhook-endpoints',
        method: 'POST',
        body: {
          'url': url,
          'eventTypes': eventTypes,
          if (description != null) 'description': description,
        },
        fromJson: CreateWebhookEndpointResult.fromJson,
      );

  Future<WebhookEndpoint> get(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id',
        fromJson: WebhookEndpoint.fromJson,
      );

  Future<WebhookEndpoint> update(
    String organizationId,
    String id, {
    String? url,
    String? description,
    List<String>? eventTypes,
  }) =>
      _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id',
        method: 'PATCH',
        body: {
          if (url != null) 'url': url,
          if (description != null) 'description': description,
          if (eventTypes != null) 'eventTypes': eventTypes,
        },
        fromJson: WebhookEndpoint.fromJson,
      );

  Future<RotateWebhookEndpointSecretResult> rotateSecret(String organizationId, String id) =>
      _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id/rotate-secret',
        method: 'POST',
        fromJson: RotateWebhookEndpointSecretResult.fromJson,
      );

  Future<WebhookEndpoint> suspend(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id/suspend',
        method: 'POST',
        fromJson: WebhookEndpoint.fromJson,
      );

  Future<WebhookEndpoint> reactivate(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id/reactivate',
        method: 'POST',
        fromJson: WebhookEndpoint.fromJson,
      );

  Future<void> delete(String organizationId, String id) =>
      _client.requestVoid('/organizations/$organizationId/webhook-endpoints/$id');

  Future<List<WebhookDelivery>> listDeliveries(String organizationId, String id) => _client.requestList(
        '/organizations/$organizationId/webhook-endpoints/$id/deliveries',
        fromJson: WebhookDelivery.fromJson,
      );

  Future<WebhookDelivery> replayDelivery(String organizationId, String id, String deliveryId) =>
      _client.request(
        '/organizations/$organizationId/webhook-endpoints/$id/deliveries/$deliveryId/replay',
        method: 'POST',
        fromJson: WebhookDelivery.fromJson,
      );
}
