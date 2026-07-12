import { ArgumentsHost, BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AIProviderError } from '../src/modules/ai/providers/ai-provider.interface';

jest.mock('../src/error-reporting', () => ({
  captureException: jest.fn(),
}));

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function buildHost(): {
  host: ArgumentsHost;
  response: { status: jest.Mock; json: jest.Mock<void, [ErrorResponseBody]> };
} {
  const json = jest.fn<void, [ErrorResponseBody]>();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, json };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ headers: {}, url: '/api/v1/test', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function firstResponseBody(response: {
  json: jest.Mock<void, [ErrorResponseBody]>;
}): ErrorResponseBody {
  return response.json.mock.calls[0][0];
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('maps AIProviderError to a 503 with a distinguishable code and the provider message', () => {
    const { host, response } = buildHost();
    const error = new AIProviderError('You exceeded your current quota', 'quota_exceeded', true);

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    const body = firstResponseBody(response);
    expect(body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(body.error.message).toBe('You exceeded your current quota');
  });

  it('maps a plain Error to a generic 500 without leaking its message', () => {
    const { host, response } = buildHost();

    filter.catch(new Error('some internal detail'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = firstResponseBody(response);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('Internal server error');
  });

  it('preserves an HttpException status and message', () => {
    const { host, response } = buildHost();

    filter.catch(new BadRequestException('invalid input'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = firstResponseBody(response);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('invalid input');
  });

  it('joins validation-array messages and reports them as details', () => {
    const { host, response } = buildHost();

    filter.catch(
      new BadRequestException(['email must be an email', 'password is too short']),
      host,
    );

    const body = firstResponseBody(response);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toBe('email must be an email, password is too short');
    expect(body.error.details).toEqual(['email must be an email', 'password is too short']);
  });

  it('passes through an explicit `details` object on the exception response (e.g. FeatureGateGuard)', () => {
    const { host, response } = buildHost();

    filter.catch(
      new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: 'You have reached your plan\'s limit for "ai_requests".',
        details: { featureKey: 'ai_requests', limit: 100, currentUsage: 100 },
      }),
      host,
    );

    const body = firstResponseBody(response);
    expect(body.error.code).toBe('QUOTA_EXCEEDED');
    expect(body.error.details).toEqual({
      featureKey: 'ai_requests',
      limit: 100,
      currentUsage: 100,
    });
  });
});
