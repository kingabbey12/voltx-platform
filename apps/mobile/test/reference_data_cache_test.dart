import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltx_mobile/features/reference_data/data/models/reference_data_models.dart';
import 'package:voltx_mobile/features/reference_data/data/reference_data_cache.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  ReferenceDataCache freshCache() {
    SharedPreferences.setMockInitialValues({});
    return ReferenceDataCache(SharedPreferences.getInstance());
  }

  group('ReferenceDataCache', () {
    test('read returns null when nothing has been cached', () async {
      final cache = freshCache();
      final result = await cache.read('missing_key', LanguageOption.fromJson);
      expect(result, isNull);
    });

    test('write then read round-trips the same items', () async {
      final cache = freshCache();
      const items = [
        LanguageOption(code: 'en', name: 'English'),
        LanguageOption(code: 'fr', name: 'French'),
      ];

      await cache.write('languages', items, (l) => l.toJson());
      final result = await cache.read('languages', LanguageOption.fromJson);

      expect(result, isNotNull);
      expect(result!.length, 2);
      expect(result[0].code, 'en');
      expect(result[1].name, 'French');
    });

    test('read returns null once the entry is past the TTL', () async {
      SharedPreferences.setMockInitialValues({
        'languages': '{"cachedAt":"2000-01-01T00:00:00.000Z","items":[{"code":"en","name":"English"}]}',
      });
      final cache = ReferenceDataCache(SharedPreferences.getInstance());

      final result = await cache.read('languages', LanguageOption.fromJson);
      expect(result, isNull);
    });

    test('readStale ignores the TTL and returns expired entries', () async {
      SharedPreferences.setMockInitialValues({
        'languages': '{"cachedAt":"2000-01-01T00:00:00.000Z","items":[{"code":"en","name":"English"}]}',
      });
      final cache = ReferenceDataCache(SharedPreferences.getInstance());

      final result = await cache.readStale('languages', LanguageOption.fromJson);
      expect(result, isNotNull);
      expect(result!.single.code, 'en');
    });

    test('readStale returns null when no entry exists at all', () async {
      final cache = freshCache();
      final result = await cache.readStale('nope', LanguageOption.fromJson);
      expect(result, isNull);
    });

    test('string list read/write round-trips', () async {
      final cache = freshCache();
      await cache.writeStrings('timezones', ['UTC', 'Africa/Lagos']);
      final result = await cache.readStrings('timezones');
      expect(result, ['UTC', 'Africa/Lagos']);
    });

    test('read treats a corrupt cache entry as a miss rather than throwing', () async {
      SharedPreferences.setMockInitialValues({'languages': 'not valid json'});
      final cache = ReferenceDataCache(SharedPreferences.getInstance());

      final result = await cache.read('languages', LanguageOption.fromJson);
      expect(result, isNull);
    });
  });
}
