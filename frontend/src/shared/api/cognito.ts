import { config } from '@/shared/config';

export async function exchangeCodeForTokens(code: string): Promise<string> {
  const response = await fetch(`${config.COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.USER_POOL_CLIENT_ID,
      code,
      redirect_uri: `${window.location.origin}/auth/cognito/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const { id_token } = await response.json();
  return id_token;
}