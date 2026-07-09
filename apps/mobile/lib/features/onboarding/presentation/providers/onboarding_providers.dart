import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../integrations/data/models/integration_models.dart';
import '../../../integrations/presentation/providers/integration_providers.dart';
import '../../../organizations/data/repositories/organization_repository.dart';
import '../../../organizations/presentation/providers/organization_providers.dart';

/// The apps this onboarding step surfaces. All 4 are OAuth2-based
/// providers — the mobile app doesn't host an OAuth redirect target (see
/// integration_models.dart), so this step only ever shows real, existing
/// connection status; it never attempts to create a new connection.
const List<String> onboardingConnectAppProviders = [
  'GOOGLE_GMAIL',
  'MICROSOFT_OUTLOOK',
  'SLACK',
  'GOOGLE_DRIVE',
];

/// Real connection status for the onboarding "Connect Apps" step, keyed by
/// provider key. Reuses the existing integrations list endpoint — no mock
/// data.
final onboardingConnectedAppsProvider = FutureProvider.autoDispose((ref) async {
  final result = await ref.watch(
    integrationConnectionsProvider(const IntegrationPageQuery(page: 1, limit: 50)).future,
  );
  final connected = <String>{};
  for (final connection in result.items) {
    if (connection.isConnected && onboardingConnectAppProviders.contains(connection.provider)) {
      connected.add(connection.provider);
    }
  }
  return connected;
});

/// The 3 screens the onboarding wizard itself drives — Welcome and Create
/// Account are handled by the existing welcome/sign-up screens before the
/// user ever reaches this route.
enum OnboardingStep { businessInfo, connectApps, complete }

final onboardingStepProvider = StateProvider.autoDispose<OnboardingStep>((ref) {
  return OnboardingStep.businessInfo;
});

class OnboardingActionState {
  const OnboardingActionState({this.isLoading = false, this.errorMessage});

  final bool isLoading;
  final String? errorMessage;

  OnboardingActionState copyWith({bool? isLoading, String? errorMessage, bool clearError = false}) {
    return OnboardingActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// Drives the two network actions in the onboarding flow (business info
/// update, completion) with a shared loading/error surface, and advances
/// the wizard step on success.
class OnboardingController extends StateNotifier<OnboardingActionState> {
  OnboardingController(this._ref) : super(const OnboardingActionState());

  final Ref _ref;

  OrganizationRepository get _repository => _ref.read(organizationRepositoryProvider);

  String? get _organizationId => _ref.read(authSessionProvider)?.organizationId;

  Future<bool> saveBusinessInfo({
    required String name,
    String? email,
    String? website,
    String? industry,
    String? country,
    String? stateProvince,
    String? city,
    String? companySize,
    List<String>? primaryGoals,
    String? currency,
    String? language,
    String? phone,
    String? timezone,
  }) async {
    final organizationId = _organizationId;
    if (organizationId == null) {
      state = state.copyWith(errorMessage: 'No active organization found.');
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.updateOrganization(
        organizationId,
        name: name,
        email: email,
        website: website,
        industry: industry,
        country: country,
        state: stateProvince,
        city: city,
        companySize: companySize,
        primaryGoals: primaryGoals,
        currency: currency,
        language: language,
        phone: phone,
        timezone: timezone,
      );
      state = state.copyWith(isLoading: false);
      _ref.read(onboardingStepProvider.notifier).state = OnboardingStep.connectApps;
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  void skipToConnectApps() {
    _ref.read(onboardingStepProvider.notifier).state = OnboardingStep.connectApps;
  }

  void continueToComplete() {
    _ref.read(onboardingStepProvider.notifier).state = OnboardingStep.complete;
  }

  Future<bool> finishOnboarding() async {
    final organizationId = _organizationId;
    if (organizationId == null) {
      state = state.copyWith(errorMessage: 'No active organization found.');
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.completeOnboarding(organizationId);
      final session = _ref.read(authSessionProvider);
      if (session != null) {
        _ref.read(authSessionProvider.notifier).setUser(
              session.copyWith(onboardingCompleted: true),
            );
      }
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }
}

final onboardingControllerProvider =
    StateNotifierProvider.autoDispose<OnboardingController, OnboardingActionState>((ref) {
  return OnboardingController(ref);
});

/// The organization profile as it exists right now — used to prefill the
/// business info step with the real name generated at registration, rather
/// than showing blank fields.
final onboardingOrganizationProvider = FutureProvider.autoDispose((ref) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    return Future.error(StateError('No active organization'));
  }
  return ref.watch(organizationProfileProvider(organizationId).future);
});
