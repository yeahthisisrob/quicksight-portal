/**
 * GlueAdapter - what the Glue Data Catalog lets this role see. Lake
 * Formation filters every catalog read to the tables the caller is granted
 * on, so listing a database's tables as the portal's role is the cheapest
 * true answer to "can the portal read this through Athena?".
 */
import {
  GetTableCommand,
  GetTablesCommand,
  GlueClient,
  type Table,
  type TableInput,
  UpdateTableCommand,
} from '@aws-sdk/client-glue';

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

  /** A table as it is now, or null when it does not exist. */
  public async getTable(database: string, name: string, catalogId?: string): Promise<Table | null> {
    try {
      const out = await this.client.send(
        new GetTableCommand({
          DatabaseName: database,
          Name: name,
          ...(catalogId ? { CatalogId: catalogId } : {}),
        })
      );
      return out.Table ?? null;
    } catch (error) {
      if ((error as Error).name === 'EntityNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a table back at the version it was read at, so a load that
   * committed in between wins: Glue refuses with
   * ConcurrentModificationException and the caller reads again.
   */
  public async updateTable(
    database: string,
    input: TableInput,
    versionId: string | undefined,
    catalogId?: string
  ): Promise<void> {
    await this.client.send(
      new UpdateTableCommand({
        DatabaseName: database,
        TableInput: input,
        VersionId: versionId,
        SkipArchive: true,
        ...(catalogId ? { CatalogId: catalogId } : {}),
      })
    );
  }
}
