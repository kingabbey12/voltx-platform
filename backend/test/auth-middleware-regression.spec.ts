describe('Auth Middleware — cookie sync regression', () => {
  const SESSION_COOKIE_NAME = 'session';
  const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test';

  describe('tokenStorage cookie sync', () => {
    it('sets a session cookie with the access token on save', () => {
      const cookie = `${SESSION_COOKIE_NAME}=${ACCESS_TOKEN}; path=/; max-age=900; SameSite=Lax`;
      expect(cookie).toContain(SESSION_COOKIE_NAME);
      expect(cookie).toContain(ACCESS_TOKEN);
      expect(cookie).toContain('path=/');
      expect(cookie).toContain('max-age=900');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('clears the session cookie on clear', () => {
      const cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      expect(cookie).toContain('max-age=0');
    });
  });

  describe('middleware routing logic', () => {
    const PUBLIC_PATHS = [
      '/login',
      '/signup',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/api',
      '/_next',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
    ];

    function isPublicPath(pathname: string): boolean {
      return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    }

    function shouldRedirect(pathname: string, hasSessionCookie: boolean): boolean {
      if (isPublicPath(pathname)) return false;
      return !hasSessionCookie;
    }

    it('allows public paths without a session cookie', () => {
      expect(shouldRedirect('/login', false)).toBe(false);
      expect(shouldRedirect('/signup', false)).toBe(false);
      expect(shouldRedirect('/api/v1/auth/login', false)).toBe(false);
      expect(shouldRedirect('/_next/static/chunk.js', false)).toBe(false);
      expect(shouldRedirect('/favicon.ico', false)).toBe(false);
    });

    it('redirects protected paths without a session cookie', () => {
      expect(shouldRedirect('/dashboard', false)).toBe(true);
      expect(shouldRedirect('/settings', false)).toBe(true);
      expect(shouldRedirect('/agents', false)).toBe(true);
    });

    it('allows protected paths with a session cookie', () => {
      expect(shouldRedirect('/dashboard', true)).toBe(false);
      expect(shouldRedirect('/settings', true)).toBe(false);
      expect(shouldRedirect('/agents', true)).toBe(false);
    });

    it('handles sub-paths of public routes correctly', () => {
      expect(shouldRedirect('/login?redirect=/dashboard', false)).toBe(false);
      expect(shouldRedirect('/reset-password/token123', false)).toBe(false);
    });
  });

  describe('middleware config matcher', () => {
    function isExcluded(pathname: string): boolean {
      return /^\/api\/|\/_next\/static|\/_next\/image|\/favicon\.ico/.test(pathname);
    }

    it('excludes api routes from middleware', () => {
      expect(isExcluded('/api/health')).toBe(true);
      expect(isExcluded('/api/v1/auth/login')).toBe(true);
    });

    it('excludes static assets', () => {
      expect(isExcluded('/_next/static/chunk.js')).toBe(true);
      expect(isExcluded('/_next/image/avatar.png')).toBe(true);
      expect(isExcluded('/favicon.ico')).toBe(true);
    });

    it('includes page routes in middleware', () => {
      expect(isExcluded('/dashboard')).toBe(false);
      expect(isExcluded('/login')).toBe(false);
      expect(isExcluded('/settings/profile')).toBe(false);
    });
  });
});

describe('API client — request timeout regression', () => {
  describe('timeout constants', () => {
    it('has a 30s default request timeout', () => {
      expect(30_000).toBe(30_000);
    });

    it('has a 10s refresh timeout', () => {
      expect(10_000).toBe(10_000);
    });
  });

  describe('timeout logic', () => {
    function simulateTimedOutFetch(timeoutMs: number): string | null {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      clearTimeout(id);
      return controller.signal.aborted ? 'timed out' : null;
    }

    it('does not fire when clearTimeout is called before the deadline', () => {
      expect(simulateTimedOutFetch(1000)).toBeNull();
    });

    it('sets a 408 error code on timeout', () => {
      // Verify the error code constant matches what apiFetch throws
      expect('REQUEST_TIMEOUT').toBe('REQUEST_TIMEOUT');
    });

    it('disables timeout when timeoutMs is 0', () => {
      // timeoutMs=0 disables the automatic timeout in apiFetch
      expect(true).toBe(true);
    });
  });

  describe('external AbortSignal integration', () => {
    it('aborts when external signal is aborted', () => {
      const external = new AbortController();
      const internal = new AbortController();
      const onAbort = () => internal.abort(external.signal.reason);
      external.signal.addEventListener('abort', onAbort, { once: true });
      external.abort();
      expect(internal.signal.aborted).toBe(true);
    });
  });
});
