/// Reference-data models — mirror the backend's `/reference/*` response
/// shapes exactly (same field names as apps/web's lib/api/reference-data.ts)
/// so both clients are genuinely reading the same schema, not two
/// independently-shaped datasets.
class CountryOption {
  const CountryOption({
    required this.isoCode,
    required this.name,
    required this.phoneCode,
    required this.currency,
    required this.timezone,
    required this.flag,
  });

  factory CountryOption.fromJson(Map<String, dynamic> json) {
    return CountryOption(
      isoCode: json['isoCode'] as String,
      name: json['name'] as String,
      phoneCode: json['phoneCode'] as String,
      currency: json['currency'] as String,
      timezone: json['timezone'] as String?,
      flag: json['flag'] as String,
    );
  }

  final String isoCode;
  final String name;
  final String phoneCode;
  final String currency;
  final String? timezone;
  final String flag;

  Map<String, dynamic> toJson() => {
        'isoCode': isoCode,
        'name': name,
        'phoneCode': phoneCode,
        'currency': currency,
        'timezone': timezone,
        'flag': flag,
      };
}

class StateOption {
  const StateOption({required this.isoCode, required this.name});

  factory StateOption.fromJson(Map<String, dynamic> json) {
    return StateOption(
      isoCode: json['isoCode'] as String,
      name: json['name'] as String,
    );
  }

  final String isoCode;
  final String name;

  Map<String, dynamic> toJson() => {'isoCode': isoCode, 'name': name};
}

class CityOption {
  const CityOption({required this.name});

  factory CityOption.fromJson(Map<String, dynamic> json) {
    return CityOption(name: json['name'] as String);
  }

  final String name;

  Map<String, dynamic> toJson() => {'name': name};
}

class CurrencyOption {
  const CurrencyOption({required this.code, required this.countryName});

  factory CurrencyOption.fromJson(Map<String, dynamic> json) {
    return CurrencyOption(
      code: json['code'] as String,
      countryName: json['countryName'] as String,
    );
  }

  final String code;
  final String countryName;

  Map<String, dynamic> toJson() => {'code': code, 'countryName': countryName};
}

class IndustryGroup {
  const IndustryGroup({required this.category, required this.items});

  factory IndustryGroup.fromJson(Map<String, dynamic> json) {
    return IndustryGroup(
      category: json['category'] as String,
      items: (json['items'] as List<dynamic>).map((e) => e as String).toList(),
    );
  }

  final String category;
  final List<String> items;

  Map<String, dynamic> toJson() => {'category': category, 'items': items};
}

class LanguageOption {
  const LanguageOption({required this.code, required this.name});

  factory LanguageOption.fromJson(Map<String, dynamic> json) {
    return LanguageOption(
      code: json['code'] as String,
      name: json['name'] as String,
    );
  }

  final String code;
  final String name;

  Map<String, dynamic> toJson() => {'code': code, 'name': name};
}
