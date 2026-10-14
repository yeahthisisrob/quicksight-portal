/**
 * GlueAdapter - what the Glue Data Catalog lets this role see. Lake
 * Formation filters every catalog read to the tables the caller is granted
 * on, so listing a database's tables as the portal's role is the cheapest
 * true answer to "can the portal read this through Athena?".
 */
import { GetTablesCommand, GlueClient } from '@aws-sdk/client-glue';

export class GlueAdapter {
  private readonly client: GlueClient;

  public constructor(region: string, client?: GlueClient) {
    this.client = client ?? new GlueClient({ region });
  }

  /** The tables of a database this role is allowed to see; throws when the database itself is not. */
  public async listTableNames(database: string, catalogId?: string): Promise<string[]> {
    const names: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await this.client.send(
        new GetTablesCommand({
          DatabaseName: database,
          ...(catalogId ? { CatalogId: catalogId } : {}),
          ...(nextToken ? { NextToken: nextToken } : {}),
        })
      );
      for (const table of page.TableList ?? []) {
        if (table.Name) {
          names.push(table.Name);
        }
      }
      nextToken = page.NextToken;
    } while (nextToken);
    return names;
  }
}
