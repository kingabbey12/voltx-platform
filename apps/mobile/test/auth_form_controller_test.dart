import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/auth/presentation/providers/auth_providers.dart';

void main() {
  test('submit ignores repeat calls while already loading', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.listen(signUpFormProvider, (_, _) {});

    final controller = container.read(signUpFormProvider.notifier);
    var calls = 0;

    final first = controller.submit(() async {
      calls += 1;
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }, successMessage: 'signed_up');

    final second = controller.submit(() async {
      calls += 1;
    }, successMessage: 'signed_up');

    await Future.wait([first, second]);

    expect(calls, 1);
  });
}
