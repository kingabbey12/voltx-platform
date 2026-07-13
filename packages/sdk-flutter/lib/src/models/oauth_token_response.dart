/// RFC 6749 §5.1 token response — snake_case, matching the wire format
/// exactly (see backend dto/oauth-token.dto.ts).
class OAuthTokenResponse {
  const OAuthTokenResponse({
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
    required this.refreshToken,
    required this.scope,
  });

  factory OAuthTokenResponse.fromJson(Map<String, dynamic> json) => OAuthTokenResponse(
        accessToken: json['access_token'] as String,
        tokenType: json['token_type'] as String,
        expiresIn: json['expires_in'] as int,
        refreshToken: json['refresh_token'] as String,
        scope: json['scope'] as String,
      );

  final String accessToken;
  final String tokenType;
  final int expiresIn;
  final String refreshToken;
  final String scope;
}

/// RFC 7662 introspection response.
class OAuthIntrospectResponse {
  const OAuthIntrospectResponse({
    required this.active,
    this.scope,
    this.clientId,
    this.sub,
    this.exp,
    this.iat,
    this.tokenType,
  });

  factory OAuthIntrospectResponse.fromJson(Map<String, dynamic> json) => OAuthIntrospectResponse(
        active: json['active'] as bool,
        scope: json['scope'] as String?,
        clientId: json['client_id'] as String?,
        sub: json['sub'] as String?,
        exp: json['exp'] as int?,
        iat: json['iat'] as int?,
        tokenType: json['token_type'] as String?,
      );

  final bool active;
  final String? scope;
  final String? clientId;
  final String? sub;
  final int? exp;
  final int? iat;
  final String? tokenType;
}
