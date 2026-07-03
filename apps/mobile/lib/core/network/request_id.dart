/// Generates a unique request correlation ID for API calls.
String generateRequestId() {
  final timestamp = DateTime.now().microsecondsSinceEpoch;
  final random = timestamp.hashCode.abs().toRadixString(36);
  return 'req-$timestamp-$random';
}
