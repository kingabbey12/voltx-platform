import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/modules/mail/mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
    configService = module.get(ConfigService);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('does not call the Resend API when RESEND_API_KEY is not configured', async () => {
    configService.get.mockReturnValue('');

    await service.send({
      to: 'jane.doe@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the Resend API when RESEND_API_KEY is configured', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'mail.resendApiKey') return 're_test_key';
      if (key === 'mail.fromAddress') return 'Voltx <noreply@usevoltx.com>';
      return fallback;
    });
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });

    await service.send({
      to: 'jane.doe@example.com',
      subject: 'Verify your email address',
      html: '<p>verify</p>',
      text: 'verify',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');

    const body = JSON.parse(options.body as string) as {
      from: string;
      to: string;
      subject: string;
    };
    expect(body.from).toBe('Voltx <noreply@usevoltx.com>');
    expect(body.to).toBe('jane.doe@example.com');
    expect(body.subject).toBe('Verify your email address');
  });

  it('does not throw when the Resend API returns an error response', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'mail.resendApiKey') return 're_test_key';
      return fallback;
    });
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('invalid recipient'),
    });

    await expect(
      service.send({ to: 'bad', subject: 'Test', html: '<p>hi</p>', text: 'hi' }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when the fetch call itself rejects', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'mail.resendApiKey') return 're_test_key';
      return fallback;
    });
    fetchSpy.mockRejectedValue(new Error('network down'));

    await expect(
      service.send({ to: 'jane.doe@example.com', subject: 'Test', html: '<p>hi</p>', text: 'hi' }),
    ).resolves.toBeUndefined();
  });
});
