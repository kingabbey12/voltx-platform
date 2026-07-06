import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

/// Certificate pinning is prepared but OFF by default — no production TLS
/// certificate fingerprints are known from within this repo, and pinning
/// against the wrong fingerprint bricks connectivity for every client until
/// a new build ships. Supply real SHA-256 SPKI/leaf-cert fingerprints (via
/// `--dart-define=PINNED_CERT_SHA256=fingerprint1,fingerprint2` for a
/// primary + backup pin) once the production API's certificate is known,
/// and this activates automatically.
class CertificatePinningConfig {
  const CertificatePinningConfig({this.pinnedSha256Fingerprints = const []});

  factory CertificatePinningConfig.fromEnvironment() {
    const raw = String.fromEnvironment('PINNED_CERT_SHA256');
    if (raw.isEmpty) {
      return const CertificatePinningConfig();
    }
    final fingerprints = raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .where((value) => value.isNotEmpty)
        .toList();
    return CertificatePinningConfig(pinnedSha256Fingerprints: fingerprints);
  }

  /// Lowercase hex SHA-256 fingerprints of the DER-encoded leaf certificate.
  final List<String> pinnedSha256Fingerprints;

  bool get isEnabled => pinnedSha256Fingerprints.isNotEmpty;
}

/// Installs certificate pinning on [dio] when [config] has pins configured;
/// otherwise leaves the default platform TLS trust chain untouched.
///
/// Caveat that must be resolved before this is truly production-grade:
/// `HttpClient.badCertificateCallback` is only invoked by dart:io for
/// certificates that FAIL normal CA trust-chain validation — it is not
/// called for a certificate that validates normally, so as written this
/// only *rejects otherwise-untrusted* certs against the pin set, it does
/// not yet *reject a validly-signed-but-wrong* cert (true pinning). Closing
/// that gap needs either a maintained pinning package (e.g.
/// `dio_certificate_pinning`/`http_certificate_pinning`) or a raw socket
/// check of the peer certificate before the TLS handshake completes. Wiring
/// that up needs the real production certificate fingerprints first, which
/// don't exist yet — tracked here rather than silently shipped as if this
/// were already airtight.
void applyCertificatePinning(Dio dio, CertificatePinningConfig config) {
  if (!config.isEnabled) {
    return;
  }

  final adapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient();
      client.badCertificateCallback = (cert, host, port) {
        final fingerprint = sha256.convert(cert.der).toString();
        return config.pinnedSha256Fingerprints.contains(fingerprint);
      };
      return client;
    },
  );
  dio.httpClientAdapter = adapter;
}
