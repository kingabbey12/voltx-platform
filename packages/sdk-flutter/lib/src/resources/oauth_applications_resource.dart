import '../models/oauth_application.dart';
import '../models/oauth_token_response.dart';
import '../voltx_client.dart';

class OAuthApplicationsResource {
  OAuthApplicationsResource(this._client);
  final VoltxClient _client;

  Future<List<OAuthApplication>> list(String organizationId) => _client.requestList(
        '/organizations/$organizationId/oauth-applications',
        fromJson: OAuthApplication.fromJson,
      );

  Future<CreateOAuthApplicationResult> create(
    String organizationId, {
    required String name,
    required List<String> redirectUris,
    required List<String> scopes,
    String? description,
    String? logoUrl,
  }) =>
      _client.request(
        '/organizations/$organizationId/oauth-applications',
        method: 'POST',
        body: {
          'name': name,
          'redirectUris': redirectUris,
          'scopes': scopes,
          if (description != null) 'description': description,
          if (logoUrl != null) 'logoUrl': logoUrl,
        },
        fromJson: CreateOAuthApplicationResult.fromJson,
      );

  Future<OAuthApplication> get(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/oauth-applications/$id',
        fromJson: OAuthApplication.fromJson,
      );

  Future<OAuthApplication> update(
    String organizationId,
    String id, {
    String? name,
    String? description,
    String? logoUrl,
    List<String>? redirectUris,
    List<String>? scopes,
  }) =>
      _client.request(
        '/organizations/$organizationId/oauth-applications/$id',
        method: 'PATCH',
        body: {
          if (name != null) 'name': name,
          if (description != null) 'description': description,
          if (logoUrl != null) 'logoUrl': logoUrl,
          if (redirectUris != null) 'redirectUris': redirectUris,
          if (scopes != null) 'scopes': scopes,
        },
        fromJson: OAuthApplication.fromJson,
      );

  Future<RotateOAuthApplicationSecretResult> rotateSecret(String organizationId, String id) =>
      _client.request(
        '/organizations/$organizationId/oauth-applications/$id/rotate-secret',
        method: 'POST',
        fromJson: RotateOAuthApplicationSecretResult.fromJson,
      );

  Future<OAuthApplication> suspend(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/oauth-applications/$id/suspend',
        method: 'POST',
        fromJson: OAuthApplication.fromJson,
      );

  Future<OAuthApplication> reactivate(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/oauth-applications/$id/reactivate',
        method: 'POST',
        fromJson: OAuthApplication.fromJson,
      );

  Future<void> delete(String organizationId, String id) =>
      _client.requestVoid('/organizations/$organizationId/oauth-applications/$id');

  // --- RFC 6749/7009/7662 token endpoints — called by the app the SDK is
  // embedded in, acting as an OAuth client (not by the organization owner
  // managing the application registration above). ---

  Future<OAuthTokenResponse> exchangeAuthorizationCode({
    required String code,
    required String redirectUri,
    required String codeVerifier,
    required String clientId,
    required String clientSecret,
  }) async {
    final json = await _client.rawRequest(
      '/oauth/token',
      method: 'POST',
      body: {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirectUri,
        'code_verifier': codeVerifier,
        'client_id': clientId,
        'client_secret': clientSecret,
      },
    );
    return OAuthTokenResponse.fromJson(json);
  }

  Future<OAuthTokenResponse> refreshToken({
    required String refreshToken,
    required String clientId,
    required String clientSecret,
  }) async {
    final json = await _client.rawRequest(
      '/oauth/token',
      method: 'POST',
      body: {
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': clientId,
        'client_secret': clientSecret,
      },
    );
    return OAuthTokenResponse.fromJson(json);
  }

  Future<void> revokeToken({
    required String token,
    required String clientId,
    required String clientSecret,
    String? tokenTypeHint,
  }) =>
      _client.rawRequest(
        '/oauth/revoke',
        method: 'POST',
        body: {
          'token': token,
          if (tokenTypeHint != null) 'token_type_hint': tokenTypeHint,
          'client_id': clientId,
          'client_secret': clientSecret,
        },
      );

  Future<OAuthIntrospectResponse> introspectToken({
    required String token,
    required String clientId,
    required String clientSecret,
  }) async {
    final json = await _client.rawRequest(
      '/oauth/introspect',
      method: 'POST',
      body: {'token': token, 'client_id': clientId, 'client_secret': clientSecret},
    );
    return OAuthIntrospectResponse.fromJson(json);
  }
}
