import '@testing-library/jest-dom';

// The app's config module throws at import time when window.APP_CONFIG is
// missing (it is injected by /config.js in the browser). Provide a default so
// any module that transitively imports `@/shared/config` can load under
// vitest without every test having to mock the whole API barrel.
window.APP_CONFIG = {
  API_URL: 'http://localhost/api',
  AWS_REGION: 'us-east-1',
  USER_POOL_ID: 'test-pool',
  USER_POOL_CLIENT_ID: 'test-client',
  COGNITO_DOMAIN: 'test.auth.localhost',
  ENVIRONMENT: 'test',
};
