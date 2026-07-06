import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists auth tokens in platform secure storage.
///
/// Keychain accessibility is pinned to `first_unlock` on iOS/macOS: tokens
/// must survive background refresh (app can read them before the user
/// re-unlocks the device) but must never migrate to a new device or sync
/// via iCloud Keychain. Android uses EncryptedSharedPreferences. Nothing
/// sensitive is ever written to plain `shared_preferences`.
class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
                synchronizable: false,
              ),
              mOptions: MacOsOptions(
                accessibility: KeychainAccessibility.first_unlock,
                synchronizable: false,
              ),
            );

  static const _accessTokenKey = 'voltx_access_token';
  static const _refreshTokenKey = 'voltx_refresh_token';

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }
}
