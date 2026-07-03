import 'environment.dart';

/// Resolved environment configuration for the running app build.
class EnvConfig {
  const EnvConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.enableNetworkLogging,
  });

  factory EnvConfig.fromEnvironment() {
    const environmentName = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'development',
    );
    const apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

    final environment = AppEnvironment.fromName(environmentName);
    final apiBaseUrl = apiBaseUrlOverride.isNotEmpty
        ? apiBaseUrlOverride
        : environment.defaultApiBaseUrl;

    return EnvConfig(
      environment: environment,
      apiBaseUrl: apiBaseUrl,
      enableNetworkLogging: !environment.isProduction,
    );
  }

  final AppEnvironment environment;
  final String apiBaseUrl;
  final bool enableNetworkLogging;

  bool get isProduction => environment.isProduction;
}
