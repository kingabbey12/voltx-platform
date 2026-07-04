import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const tracingEnabled = process.env.OTEL_ENABLED === 'true';

if (tracingEnabled) {
  const exporterUrl =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4318/v1/traces';

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'voltx-backend',
    traceExporter: new OTLPTraceExporter({
      url: exporterUrl,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  void sdk.start();

  const shutdown = async () => {
    await sdk.shutdown();
  };

  process.once('SIGTERM', () => {
    void shutdown();
  });

  process.once('SIGINT', () => {
    void shutdown();
  });
}
