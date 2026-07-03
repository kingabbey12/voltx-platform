/// Application-wide configuration constants.
abstract final class AppConfig {
  static const String appName = 'Voltx';
  static const Duration splashDuration = Duration(milliseconds: 1800);
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
