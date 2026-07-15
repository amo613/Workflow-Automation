import { getRequiredAppUrl } from '#utils/app-url.utils.js';

describe('required application URL', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalPublicUrl = process.env.PUBLIC_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }

    if (originalPublicUrl === undefined) {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

  it('uses the explicitly configured URL and removes trailing slashes', () => {
    process.env.FRONTEND_URL = 'https://app.example.com///';
    process.env.PUBLIC_URL = 'https://fallback.example.com';

    expect(getRequiredAppUrl()).toBe('https://app.example.com');
  });

  it('falls back only to an explicitly configured PUBLIC_URL', () => {
    delete process.env.FRONTEND_URL;
    process.env.PUBLIC_URL = 'https://public.example.com/';

    expect(getRequiredAppUrl()).toBe('https://public.example.com');
  });

  it('fails when no application URL is configured', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.PUBLIC_URL;

    expect(() => getRequiredAppUrl()).toThrow(
      'FRONTEND_URL or PUBLIC_URL must be configured'
    );
  });

  it('fails when the configured value is not an absolute URL', () => {
    process.env.FRONTEND_URL = 'app.example.com';
    delete process.env.PUBLIC_URL;

    expect(() => getRequiredAppUrl()).toThrow(
      'FRONTEND_URL or PUBLIC_URL must be a valid absolute URL'
    );
  });
});
