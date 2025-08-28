import { fromEnv, fromIni } from '@aws-sdk/credential-providers';

/**
 * Shared AWS configuration utility for all AWS SDK clients
 */
export function getAwsConfig(): any {
  const config: any = {
    region: process.env.AWS_REGION || 'us-east-1',
  };

  // Use explicit credentials if provided - these take priority over profile
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    // Use fromEnv to ensure we only use environment variables, not profile
    config.credentials = fromEnv();
  } else if (process.env.AWS_PROFILE) {
    // Use profile-based credentials if AWS_PROFILE is set
    config.credentials = fromIni({ profile: process.env.AWS_PROFILE });
  }
  return config;
}
