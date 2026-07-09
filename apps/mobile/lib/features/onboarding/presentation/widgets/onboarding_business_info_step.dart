import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_searchable_sheet.dart';
import '../../../../theme/components/voltx_selector_field.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/widgets/auth_staggered_fade.dart';
import '../../../auth/utils/auth_validators.dart';
import '../../../reference_data/data/models/reference_data_models.dart';
import '../../../reference_data/presentation/providers/reference_data_providers.dart';
import '../providers/onboarding_providers.dart';

const List<({String value, String label})> _companySizeOptions = [
  (value: 'JUST_ME', label: 'Just Me'),
  (value: 'EMPLOYEES_2_10', label: '2–10 employees'),
  (value: 'EMPLOYEES_11_50', label: '11–50 employees'),
  (value: 'EMPLOYEES_51_200', label: '51–200 employees'),
  (value: 'EMPLOYEES_201_500', label: '201–500 employees'),
  (value: 'EMPLOYEES_501_1000', label: '501–1000 employees'),
  (value: 'EMPLOYEES_1000_PLUS', label: '1000+ employees'),
];

const List<({String value, String label})> _primaryGoalOptions = [
  (value: 'SALES', label: 'Sales'),
  (value: 'MARKETING', label: 'Marketing'),
  (value: 'CUSTOMER_SUPPORT', label: 'Customer Support'),
  (value: 'OPERATIONS', label: 'Operations'),
  (value: 'PROJECT_MANAGEMENT', label: 'Project Management'),
  (value: 'FINANCE', label: 'Finance'),
  (value: 'HUMAN_RESOURCES', label: 'Human Resources'),
  (value: 'AI_AUTOMATION', label: 'AI Automation'),
  (value: 'TEAM_COLLABORATION', label: 'Team Collaboration'),
  (value: 'BUSINESS_INTELLIGENCE', label: 'Business Intelligence'),
  (value: 'CRM', label: 'CRM'),
  (value: 'WORKFLOW_AUTOMATION', label: 'Workflow Automation'),
];

final RegExp _websitePattern = RegExp(r'^https?:\/\/.+', caseSensitive: false);
final RegExp _phonePattern = RegExp(r'^\+[1-9]\d{6,14}$');

class OnboardingBusinessInfoStep extends HookConsumerWidget {
  const OnboardingBusinessInfoStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final formKey = useMemoized(GlobalKey<FormState>.new);

    final nameController = useTextEditingController();
    final emailController = useTextEditingController();
    final websiteController = useTextEditingController();
    final phoneDigitsController = useTextEditingController();

    final industry = useState<String?>(null);
    final companySize = useState<String?>(null);
    final primaryGoals = useState<Set<String>>(const {});
    final countryIso = useState<String?>(null);
    final stateIso = useState<String?>(null);
    final cityName = useState<String?>(null);
    final currency = useState<String?>(null);
    final timezone = useState<String?>(null);
    final language = useState<String?>(null);

    final prefilled = useState(false);
    final autoFilledFromCountry = useState(false);
    final showValidationErrors = useState(false);

    final organizationAsync = ref.watch(onboardingOrganizationProvider);
    final actionState = ref.watch(onboardingControllerProvider);

    final countriesAsync = ref.watch(countriesProvider);
    final industriesAsync = ref.watch(industriesProvider);
    final currenciesAsync = ref.watch(currenciesProvider);
    final timezonesAsync = ref.watch(timezonesProvider);
    final languagesAsync = ref.watch(languagesProvider);
    final statesAsync = countryIso.value == null
        ? null
        : ref.watch(statesForCountryProvider(countryIso.value!));
    final citiesAsync = (countryIso.value == null || stateIso.value == null)
        ? null
        : ref.watch(citiesForStateProvider((country: countryIso.value!, state: stateIso.value!)));

    final countries = countriesAsync.valueOrNull ?? const <CountryOption>[];

    CountryOption? findCountry(String? iso) {
      if (iso == null) return null;
      for (final c in countries) {
        if (c.isoCode == iso) return c;
      }
      return null;
    }

    ref.listen(onboardingOrganizationProvider, (previous, next) {
      final org = next.valueOrNull;
      if (org != null && !prefilled.value) {
        prefilled.value = true;
        nameController.text = org.name;
        emailController.text = org.email ?? '';
        websiteController.text = org.website ?? '';
        industry.value = org.industry;
        companySize.value = org.companySize;
        primaryGoals.value = org.primaryGoals.toSet();
        countryIso.value = org.country;
        stateIso.value = org.state;
        cityName.value = org.city;
        currency.value = org.currency;
        timezone.value = org.timezone;
        language.value = org.language;
        if (org.phone != null && org.phone!.isNotEmpty) {
          final match = RegExp(r'^(\+\d+)(\d*)$').firstMatch(org.phone!);
          phoneDigitsController.text = match?.group(2) ?? '';
        }
      }
    });

    final selectedCountry = findCountry(countryIso.value);
    final phoneCode = selectedCountry?.phoneCode ?? '';

    Future<void> pickSingle({
      required String title,
      required List<({String value, String label})> options,
      required ValueChanged<String?> onSelected,
      String? current,
    }) async {
      final result = await showVoltxSearchableSheet<({String value, String label})>(
        context: context,
        title: title,
        items: options,
        itemLabel: (o) => o.label,
        itemValue: (o) => o.value,
        initialSelected: current == null ? const {} : {current},
      );
      if (result != null && result.isNotEmpty) {
        onSelected(result.first);
      }
    }

    Future<void> pickCountry() async {
      final result = await showVoltxSearchableSheet<CountryOption>(
        context: context,
        title: 'Country / Region',
        items: countries,
        itemLabel: (c) => '${c.flag}  ${c.name}',
        itemValue: (c) => c.isoCode,
        initialSelected: countryIso.value == null ? const {} : {countryIso.value!},
      );
      if (result == null || result.isEmpty) return;
      final iso = result.first;
      countryIso.value = iso;
      stateIso.value = null;
      cityName.value = null;
      final country = findCountry(iso);
      if (country != null) {
        currency.value = country.currency;
        if (country.timezone != null) timezone.value = country.timezone;
        if (phoneDigitsController.text.isEmpty) {
          // Nothing to re-prefix — the chip alone (derived from
          // selectedCountry) already reflects the new code.
        }
        autoFilledFromCountry.value = true;
      }
    }

    Future<void> pickState() async {
      final options = statesAsync?.valueOrNull ?? const <StateOption>[];
      final result = await showVoltxSearchableSheet<StateOption>(
        context: context,
        title: 'State / Province',
        items: options,
        itemLabel: (s) => s.name,
        itemValue: (s) => s.isoCode,
        initialSelected: stateIso.value == null ? const {} : {stateIso.value!},
      );
      if (result != null && result.isNotEmpty) {
        stateIso.value = result.first;
        cityName.value = null;
      }
    }

    Future<void> pickCity() async {
      final options = citiesAsync?.valueOrNull ?? const <CityOption>[];
      final result = await showVoltxSearchableSheet<CityOption>(
        context: context,
        title: 'City',
        items: options,
        itemLabel: (c) => c.name,
        itemValue: (c) => c.name,
        initialSelected: cityName.value == null ? const {} : {cityName.value!},
      );
      if (result != null && result.isNotEmpty) {
        cityName.value = result.first;
      }
    }

    Future<void> pickIndustry() async {
      final groups = industriesAsync.valueOrNull ?? const <IndustryGroup>[];
      final flat = <MapEntry<String, String>>[
        for (final g in groups)
          for (final item in g.items) MapEntry(item, g.category),
      ];
      final result = await showVoltxSearchableSheet<MapEntry<String, String>>(
        context: context,
        title: 'Industry',
        items: flat,
        itemLabel: (e) => e.key,
        itemValue: (e) => e.key,
        itemGroup: (e) => e.value,
        initialSelected: industry.value == null ? const {} : {industry.value!},
      );
      if (result != null && result.isNotEmpty) {
        industry.value = result.first;
      }
    }

    Future<void> pickPrimaryGoals() async {
      final result = await showVoltxSearchableSheet<({String value, String label})>(
        context: context,
        title: 'Primary Goal',
        items: _primaryGoalOptions,
        itemLabel: (o) => o.label,
        itemValue: (o) => o.value,
        initialSelected: primaryGoals.value,
        multiSelect: true,
      );
      if (result != null) {
        primaryGoals.value = result;
      }
    }

    Future<void> pickCurrency() async {
      final options = currenciesAsync.valueOrNull ?? const <CurrencyOption>[];
      final result = await showVoltxSearchableSheet<CurrencyOption>(
        context: context,
        title: 'Preferred Currency',
        items: options,
        itemLabel: (c) => '${c.code} — ${c.countryName}',
        itemValue: (c) => c.code,
        initialSelected: currency.value == null ? const {} : {currency.value!},
      );
      if (result != null && result.isNotEmpty) {
        currency.value = result.first;
      }
    }

    Future<void> pickTimezone() async {
      final options = timezonesAsync.valueOrNull ?? const <String>[];
      final result = await showVoltxSearchableSheet<String>(
        context: context,
        title: 'Timezone',
        items: options,
        itemLabel: (tz) => tz.replaceAll('_', ' '),
        itemValue: (tz) => tz,
        initialSelected: timezone.value == null ? const {} : {timezone.value!},
      );
      if (result != null && result.isNotEmpty) {
        timezone.value = result.first;
      }
    }

    Future<void> pickLanguage() async {
      final options = languagesAsync.valueOrNull ?? const <LanguageOption>[];
      final result = await showVoltxSearchableSheet<LanguageOption>(
        context: context,
        title: 'Preferred Language',
        items: options,
        itemLabel: (l) => l.name,
        itemValue: (l) => l.code,
        initialSelected: language.value == null ? const {} : {language.value!},
      );
      if (result != null && result.isNotEmpty) {
        language.value = result.first;
      }
    }

    String? companySizeLabel(String? value) {
      for (final o in _companySizeOptions) {
        if (o.value == value) return o.label;
      }
      return null;
    }

    String? industryLabelFor(String? value) => value;

    String? currencyLabel(String? code) {
      if (code == null) return null;
      final options = currenciesAsync.valueOrNull ?? const <CurrencyOption>[];
      for (final c in options) {
        if (c.code == code) return '${c.code} — ${c.countryName}';
      }
      return code;
    }

    String? languageLabel(String? code) {
      if (code == null) return null;
      final options = languagesAsync.valueOrNull ?? const <LanguageOption>[];
      for (final l in options) {
        if (l.code == code) return l.name;
      }
      return code;
    }

    bool hasPickerErrors() {
      return industry.value == null ||
          countryIso.value == null ||
          companySize.value == null ||
          primaryGoals.value.isEmpty;
    }

    Future<void> submit() async {
      final formValid = formKey.currentState?.validate() ?? false;
      final pickersValid = !hasPickerErrors();
      if (!formValid || !pickersValid) {
        showValidationErrors.value = true;
        return;
      }

      final digits = phoneDigitsController.text.trim();
      final phone = digits.isEmpty ? null : '$phoneCode$digits';

      await ref.read(onboardingControllerProvider.notifier).saveBusinessInfo(
            name: nameController.text.trim(),
            email: emailController.text.trim(),
            website: websiteController.text.trim().isEmpty ? null : websiteController.text.trim(),
            industry: industry.value,
            country: countryIso.value,
            stateProvince: stateIso.value,
            city: cityName.value,
            companySize: companySize.value,
            primaryGoals: primaryGoals.value.toList(),
            currency: currency.value,
            language: language.value,
            timezone: timezone.value,
            phone: phone,
          );
    }

    return AuthStaggeredFade(
      children: [
        Text('Tell us about your business', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'This helps Voltx tailor agents, workflows, and defaults to how you actually work.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        AsyncValueView(
          value: organizationAsync,
          onRetry: () => ref.invalidate(onboardingOrganizationProvider),
          data: (context, _) => Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SectionLabel('Business identity'),
                VoltxTextField(
                  controller: nameController,
                  label: 'Business Name *',
                  helper: 'Enter your company or organization name.',
                  textInputAction: TextInputAction.next,
                  validator: (v) => AuthValidators.name(v, fieldLabel: 'Business name'),
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxTextField(
                  controller: emailController,
                  label: 'Business Email *',
                  helper: 'Used for notifications and communication.',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  validator: AuthValidators.email,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxTextField(
                  controller: websiteController,
                  label: 'Website',
                  hint: 'https://example.com',
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.next,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return null;
                    return _websitePattern.hasMatch(v.trim())
                        ? null
                        : 'Enter a full URL, e.g. https://example.com';
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionLabel('Classification'),
                VoltxSelectorField(
                  label: 'Industry *',
                  placeholder: industriesAsync.isLoading ? 'Loading...' : 'Select an industry',
                  valueText: industryLabelFor(industry.value),
                  enabled: !industriesAsync.isLoading,
                  errorText:
                      showValidationErrors.value && industry.value == null ? 'Select an industry' : null,
                  onTap: pickIndustry,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'Company Size *',
                  placeholder: 'Select size',
                  valueText: companySizeLabel(companySize.value),
                  errorText: showValidationErrors.value && companySize.value == null
                      ? 'Select a company size'
                      : null,
                  onTap: () => pickSingle(
                    title: 'Company Size',
                    options: _companySizeOptions,
                    current: companySize.value,
                    onSelected: (v) => companySize.value = v,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'Primary Goal *',
                  placeholder: 'Select goals',
                  valueText: primaryGoals.value.isEmpty ? null : '${primaryGoals.value.length} selected',
                  errorText: showValidationErrors.value && primaryGoals.value.isEmpty
                      ? 'Select at least one goal'
                      : null,
                  onTap: pickPrimaryGoals,
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionLabel('Location'),
                VoltxSelectorField(
                  label: 'Country / Region *',
                  placeholder: countriesAsync.isLoading ? 'Loading...' : 'Select a country',
                  valueText: selectedCountry == null ? null : '${selectedCountry.flag} ${selectedCountry.name}',
                  enabled: !countriesAsync.isLoading,
                  errorText:
                      showValidationErrors.value && countryIso.value == null ? 'Select a country' : null,
                  onTap: pickCountry,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'State / Province',
                  placeholder: countryIso.value == null
                      ? 'Select a country first'
                      : (statesAsync?.isLoading ?? false)
                          ? 'Loading...'
                          : 'Select a state',
                  valueText: stateIso.value == null
                      ? null
                      : (statesAsync?.valueOrNull ?? const <StateOption>[])
                          .where((s) => s.isoCode == stateIso.value)
                          .map((s) => s.name)
                          .firstOrNullOr(stateIso.value),
                  enabled: countryIso.value != null,
                  onTap: pickState,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'City',
                  placeholder: stateIso.value == null ? 'Select a state first' : 'Select a city',
                  valueText: cityName.value,
                  enabled: stateIso.value != null,
                  onTap: pickCity,
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionLabel(
                  autoFilledFromCountry.value
                      ? 'Locale & contact — auto-filled from your country, feel free to change'
                      : 'Locale & contact',
                ),
                VoltxSelectorField(
                  label: 'Preferred Currency',
                  placeholder: 'Select a currency',
                  valueText: currencyLabel(currency.value),
                  onTap: pickCurrency,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'Timezone',
                  placeholder: 'Select a timezone',
                  valueText: timezone.value,
                  onTap: pickTimezone,
                ),
                const SizedBox(height: AppSpacing.sm),
                VoltxSelectorField(
                  label: 'Preferred Language',
                  placeholder: 'Select a language',
                  valueText: languageLabel(language.value),
                  onTap: pickLanguage,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Phone Number',
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: colors.textSecondary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                      decoration: BoxDecoration(
                        borderRadius: context.voltxRadii.mdBorder,
                        color: colors.surfaceMuted.withValues(alpha: 0.76),
                        border: Border.all(color: colors.borderSubtle),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        phoneCode.isEmpty ? '+--' : phoneCode,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textPrimary),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: VoltxTextField(
                        controller: phoneDigitsController,
                        hint: '501234567',
                        keyboardType: TextInputType.phone,
                        enabled: phoneCode.isNotEmpty,
                        textInputAction: TextInputAction.done,
                        validator: (v) {
                          final digits = v?.trim() ?? '';
                          if (digits.isEmpty) return null;
                          final combined = '$phoneCode$digits';
                          return _phonePattern.hasMatch(combined) ? null : 'Enter a valid phone number';
                        },
                        onSubmitted: (_) => submit(),
                      ),
                    ),
                  ],
                ),
                if (actionState.errorMessage != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    actionState.errorMessage!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                VoltxButton(
                  label: 'Continue',
                  isExpanded: true,
                  size: VoltxButtonSize.large,
                  isLoading: actionState.isLoading,
                  onPressed: submit,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.textTertiary,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
      ),
    );
  }
}

extension _FirstOrNullOr on Iterable<String> {
  String? firstOrNullOr(String? fallback) {
    final it = iterator;
    if (it.moveNext()) return it.current;
    return fallback;
  }
}
