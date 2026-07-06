import 'app/bootstrap.dart';
import 'core/observability/crash_reporting.dart';

Future<void> main() => runWithCrashReporting(bootstrap);
