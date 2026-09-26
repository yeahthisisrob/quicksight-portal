/**
 * StsAdapter - who the Lambda is running as. Used by SMUS project discovery
 * so an empty project list can name the exact principal DataZone saw.
 */
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

interface CallerIdentity {
  arn: string;
  account: string;
}

export class StsAdapter {
  private readonly client: STSClient;

  public constructor(region: string) {
    this.client = new STSClient({ region });
  }

  public async getCallerIdentity(): Promise<CallerIdentity> {
    const response = await this.client.send(new GetCallerIdentityCommand({}));
    return { arn: response.Arn ?? '', account: response.Account ?? '' };
  }
}
