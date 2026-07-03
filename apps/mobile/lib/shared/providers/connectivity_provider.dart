import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum NetworkStatus {
  online,
  offline,
}

NetworkStatus _mapConnectivity(List<ConnectivityResult> results) {
  final isOffline = results.every(
    (result) => result == ConnectivityResult.none,
  );
  return isOffline ? NetworkStatus.offline : NetworkStatus.online;
}

final connectivityProvider = StreamProvider<NetworkStatus>((ref) async* {
  final connectivity = Connectivity();

  yield _mapConnectivity(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(_mapConnectivity);
});

final networkStatusProvider = Provider<NetworkStatus>((ref) {
  return ref.watch(connectivityProvider).maybeWhen(
        data: (status) => status,
        orElse: () => NetworkStatus.online,
      );
});
