import { vi } from 'vitest';

// Vitest setup file
// Suppress console logs during tests unless explicitly needed
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Set test environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCOUNT_ID = '123456789012';
process.env.BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

// Suppress AWS Lambda Powertools Logger during tests
process.env.LOG_LEVEL = 'ERROR';
process.env.POWERTOOLS_LOGGER_SAMPLE_RATE = '0';
process.env.POWERTOOLS_DEV = 'false';

// Mock AWS credential providers to prevent real credential loading
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn(
    () => () =>
      Promise.resolve({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
      })
  ),
}));

// Mock AWS SDK v2 to prevent credential bridging errors
vi.mock('aws-sdk', () => ({
  QuickSight: vi.fn().mockImplementation(() => ({
    config: {
      update: vi.fn(),
    },
    listDataSources: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({
        DataSources: [],
      }),
    }),
  })),
  Credentials: vi.fn(),
}));

// Prevent QuickSightAdapter from trying to initialize v2 client in tests
process.env.NODE_ENV = 'test';
