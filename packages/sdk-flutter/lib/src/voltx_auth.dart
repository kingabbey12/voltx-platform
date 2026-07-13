import 'models/oauth_token_response.dart';

/// One of every credential type the backend accepts (see AUTH_GUARDS
/// alternatives across src/modules/security, developer-platform, and
/// oauth-provider) — [VoltxClient] picks the matching header(s) for
/// whichever mode is configured.
sealed class VoltxAuth {
  const VoltxAuth();
}

class ApiKeyAuth extends VoltxAuth {
  const ApiKeyAuth(this.apiKey);
  final String apiKey;
}

class PersonalAccessTokenAuth extends VoltxAuth {
  const PersonalAccessTokenAuth({required this.token, required this.organizationId});
  final String token;
  final String organizationId;
}

class ServiceAccountTokenAuth extends VoltxAuth {
  const ServiceAccountTokenAuth(this.token);
  final String token;
}

/// Mutable (unlike the other auth modes) — [VoltxClient]'s automatic
/// retry-on-401 refresh flow updates [accessToken]/[refreshToken] in place
/// when [refreshToken]/[clientId]/[clientSecret] are all set.
class OAuthAuth extends VoltxAuth {
  OAuthAuth({
    required this.accessToken,
    this.refreshToken,
    this.clientId,
    this.clientSecret,
    this.onTokensRefreshed,
  });

  String accessToken;
  String? refreshToken;
  final String? clientId;
  final String? clientSecret;
  final void Function(OAuthTokenResponse tokens)? onTokensRefreshed;
}
