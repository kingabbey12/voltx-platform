import 'dart:io' show Platform;

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
      // The Android emulator's own loopback is not the host machine's —
      // 10.0.2.2 is the documented special alias Android's emulator
      // provides for reaching localhost on the host. iOS/macOS share the
      // host's network stack directly, so plain localhost is correct
      // there. Real devices need --dart-define=API_BASE_URL=... pointed
      // at the host's LAN IP regardless of platform; this default only
      // covers the common emulator/simulator dev loop.
      AppEnvironment.development =>
        Platform.isAndroid ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1',
      AppEnvironment.staging => 'https://staging-api.usevoltx.com/api/v1',
      AppEnvironment.production => 'https://api.usevoltx.com/api/v1',
    };
  }

  bool get isProduction => this == AppEnvironment.production;
}
