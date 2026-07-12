import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { context, Span, SpanContext, trace } from '@opentelemetry/api';
import { traceContextMixin } from '../src/config/pino-logger.config';

function withFakeActiveSpan<T>(spanContext: SpanContext, fn: () => T): T {
  const fakeSpan = { spanContext: () => spanContext } as unknown as Span;
  const ctx = trace.setSpan(context.active(), fakeSpan);
  return context.with(ctx, fn);
}

describe('traceContextMixin', () => {
  const contextManager = new AsyncHooksContextManager();

  beforeAll(() => {
    // NodeSDK (src/tracing.ts) registers this same context manager under
    // the hood when OTEL_ENABLED=true — without registering one here,
    // @opentelemetry/api's default no-op manager makes context.with() a
    // pass-through that never actually makes the span "active", which
    // would make this test pass for the wrong reason.
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
  });

  afterAll(() => {
    context.disable();
    contextManager.disable();
  });

  it('returns the active span’s trace/span id when one exists (OTEL_ENABLED=true path)', () => {
    const spanContext: SpanContext = {
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: 'b7ad6b7169203331',
      traceFlags: 1,
    };

    const result = withFakeActiveSpan(spanContext, () => traceContextMixin());

    expect(result).toEqual({
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: 'b7ad6b7169203331',
    });
  });

  it('returns an empty object — not undefined-poisoned fields — when there is no active span (OTEL_ENABLED=false)', () => {
    const result = traceContextMixin();

    expect(result).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(result, 'traceId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'spanId')).toBe(false);
  });
});
