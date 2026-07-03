/// Supported runtime environments for the Voltx mobile client.
enum AppEnvironment {
  development,
  staging,
  production;

  static AppEnvironment fromName(String value) {
    return AppEnvironment.values.firstWhere(
      (environment) => environment.name == value,
      orElse: () => AppEnvironment.development,
    );
  }

  String get defaultApiBaseUrl {
    return switch (this) {
      AppEnvironment.development => 'http://localhost:3000/api/v1',
      AppEnvironment.staging => 'https://staging-api.voltx.io/api/v1',
      AppEnvironment.production => 'https://api.voltx.io/api/v1',
    };
  }

  bool get isProduction => this == AppEnvironment.production;
}
