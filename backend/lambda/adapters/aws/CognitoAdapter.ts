import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/** A portal sign-in, as the user pool knows it. */
export interface CognitoPerson {
  username: string;
  email?: string;
  name?: string;
}

/**
 * The portal's Cognito user pool, read-only: who a sign-in id (the `sub`
 * older job and archive records kept) belongs to. ListUsers with a `sub`
 * filter is the documented lookup by sub; it needs cognito-idp:ListUsers
 * on the pool.
 */
export class CognitoAdapter {
  private readonly client: CognitoIdentityProviderClient;

  public constructor(
    private readonly userPoolId: string,
    region: string,
    client?: CognitoIdentityProviderClient
  ) {
    this.client = client ?? new CognitoIdentityProviderClient({ region });
  }

  public async findBySub(sub: string): Promise<CognitoPerson | null> {
    const response = await this.client.send(
      new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `sub = "${sub.replace(/"/g, '')}"`,
        Limit: 1,
      })
    );
    const user = response.Users?.[0];
    if (!user?.Username) {
      return null;
    }
    const attribute = (name: string) => user.Attributes?.find((a) => a.Name === name)?.Value;
    return {
      username: user.Username,
      ...(attribute('email') ? { email: attribute('email') } : {}),
      ...(attribute('name') ? { name: attribute('name') } : {}),
    };
  }
}
