/**
 * AthenaAdapter - the one thing the portal asks Athena: what columns a
 * query returns. QuickSight refuses a custom SQL dataset without declared
 * columns, and its console learns them by running the query; this does the
 * same, through the data source's workgroup, reading no rows.
 */
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetWorkGroupCommand,
  StartQueryExecutionCommand,
  StopQueryExecutionCommand,
} from '@aws-sdk/client-athena';

import { logger } from '../../shared/utils/logger';

/** One column of a result set, in Athena's own type vocabulary (varchar, bigint, ...). */
export interface AthenaColumn {
  name: string;
  type: string;
}

interface SchemaQuery {
  /** The query whose result columns are wanted, as the person wrote it. */
  sql: string;
  workGroup: string;
  /** Where Athena writes the (empty) result, unless the workgroup enforces its own location. */
  outputLocation: string;
  catalog?: string;
  database?: string;
  /** Give up after this long; the gateway window is the ceiling. */
  timeoutMs: number;
}

/** Athena refused or failed the query; the message is the engine's reason. */
class AthenaQueryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AthenaQueryError';
  }
}

const POLL_MS = 500;
/** Athena's wording when the caller cannot reach the results location. */
const OUTPUT_LOCATION_FAILURE = /output (bucket|location)|verify\/create|query results/i;
const MS_PER_SECOND = 1000;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The query as a derived table with no rows: Athena plans it, so the result
 * metadata carries every column and type, and no data is read.
 */
export function schemaQuery(sql: string): string {
  const body = sql.trim().replace(/;+\s*$/, '');
  return `SELECT * FROM (\n${body}\n) AS portal_schema LIMIT 0`;
}

export class AthenaAdapter {
  private readonly client: AthenaClient;

  public constructor(region: string, client?: AthenaClient) {
    this.client = client ?? new AthenaClient({ region });
  }

  /**
   * Where this workgroup's results go: its own location when it enforces
   * its configuration, otherwise the one the caller names. Known before the
   * query runs, so a failure to write there can say which bucket to grant.
   */
  private async resultsLocation(
    input: SchemaQuery
  ): Promise<{ location: string; enforced: boolean }> {
    const workGroup = await this.client.send(
      new GetWorkGroupCommand({ WorkGroup: input.workGroup })
    );
    const configuration = workGroup.WorkGroup?.Configuration;
    const own = configuration?.ResultConfiguration?.OutputLocation;
    if (configuration?.EnforceWorkGroupConfiguration && own) {
      return { location: own, enforced: true };
    }
    return { location: input.outputLocation, enforced: false };
  }

  /** The columns `sql` returns, without reading a row. */
  public async querySchema(input: SchemaQuery): Promise<AthenaColumn[]> {
    const results = await this.resultsLocation(input);
    const started = await this.client.send(
      new StartQueryExecutionCommand({
        QueryString: schemaQuery(input.sql),
        WorkGroup: input.workGroup,
        ResultConfiguration: { OutputLocation: results.location },
        ...(input.catalog || input.database
          ? {
              QueryExecutionContext: {
                ...(input.catalog ? { Catalog: input.catalog } : {}),
                ...(input.database ? { Database: input.database } : {}),
              },
            }
          : {}),
      })
    );
    const queryExecutionId = started.QueryExecutionId;
    if (!queryExecutionId) {
      throw new AthenaQueryError('Athena did not start the query');
    }
    const deadline = Date.now() + input.timeoutMs;
    for (;;) {
      const execution = await this.client.send(
        new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
      );
      const status = execution.QueryExecution?.Status;
      const state = status?.State ?? '';
      if (state === 'SUCCEEDED') {
        break;
      }
      if (TERMINAL.has(state)) {
        const reason = status?.StateChangeReason || `the query ${state.toLowerCase()}`;
        throw new AthenaQueryError(
          OUTPUT_LOCATION_FAILURE.test(reason)
            ? `${reason} The query's results go to ${results.location}${results.enforced ? ` (enforced by workgroup ${input.workGroup})` : ''}; the portal's role needs s3:GetBucketLocation, s3:ListBucket and s3:PutObject there`
            : reason
        );
      }
      if (Date.now() >= deadline) {
        await this.client
          .send(new StopQueryExecutionCommand({ QueryExecutionId: queryExecutionId }))
          .catch((error) => logger.warn('Athena schema query could not be stopped', { error }));
        throw new AthenaQueryError(
          `the query did not finish within ${Math.round(input.timeoutMs / MS_PER_SECOND)} seconds`
        );
      }
      await sleep(POLL_MS);
    }
    const resultSet = await this.client.send(
      new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, MaxResults: 1 })
    );
    const columns = resultSet.ResultSet?.ResultSetMetadata?.ColumnInfo ?? [];
    return columns
      .filter((c) => typeof c.Name === 'string' && c.Name !== '')
      .map((c) => ({ name: c.Name as string, type: c.Type ?? 'varchar' }));
  }
}
