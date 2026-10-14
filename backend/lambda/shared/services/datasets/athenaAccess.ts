/**
 * Whether the portal's role can read the governed tables through Athena,
 * database by database. Lake Formation hides a table from a principal with
 * no grant on it, so the check is a catalog read as the role: the tables it
 * sees against the tables the listings publish. The grant itself is a data
 * lake admin's action, never the portal's, so the report carries the exact
 * command for them.
 */
import type { SmusAsset } from '../../types/smus';

interface AthenaAccessDatabase {
  name: string;
  /** The Glue catalog id when the listing names one other than the account's. */
  catalog?: string;
  /** Published listings backed by tables in this database. */
  listings: number;
  /** All of those tables are visible to the role, some are, none are, or the check failed. */
  visible: 'all' | 'some' | 'none' | 'unknown';
  /** Listing tables the role cannot see (at most a few, to name them). */
  hiddenTables: string[];
  /** Why the check could not be made, when it could not. */
  error?: string;
}

export interface AthenaAccessReport {
  /** The IAM role the portal runs as, the principal to grant. */
  role: string;
  databases: AthenaAccessDatabase[];
  /** One `just athena-grant` per catalog that still has hidden tables; empty when everything is visible. */
  commands: string[];
  /** The same grants as plain AWS CLI calls, for an admin with credentials but not this repository. */
  awsCli: string[];
}

const MAX_NAMED = 5;
const DEFAULT_CATALOGS = new Set(['', 'awsdatacatalog']);

/** `arn:aws:sts::1:assumed-role/Name/session` is the role `arn:aws:iam::1:role/Name`. */
export function roleArnFromCaller(callerArn: string): string {
  const match = callerArn.match(/^arn:aws:sts::(\d+):assumed-role\/([^/]+)\//);
  return match ? `arn:aws:iam::${match[1]}:role/${match[2]}` : callerArn;
}

interface GlueTableLister {
  listTableNames(database: string, catalogId?: string): Promise<string[]>;
}

export async function athenaAccessReport(
  listings: Pick<SmusAsset, 'table'>[],
  glue: GlueTableLister,
  role: string
): Promise<AthenaAccessReport> {
  const byDatabase = new Map<string, { name: string; catalog?: string; tables: Set<string> }>();
  for (const listing of listings) {
    const table = listing.table;
    if (!table?.database || !table.name) {
      continue;
    }
    const catalog = DEFAULT_CATALOGS.has((table.catalog ?? '').toLowerCase())
      ? undefined
      : table.catalog;
    const key = `${catalog ?? ''}|${table.database}`;
    const group = byDatabase.get(key) ?? { name: table.database, catalog, tables: new Set() };
    group.tables.add(table.name);
    byDatabase.set(key, group);
  }

  const databases: AthenaAccessDatabase[] = [];
  for (const group of [...byDatabase.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const wanted = [...group.tables].sort();
    try {
      const seen = new Set((await glue.listTableNames(group.name, group.catalog)).map(lower));
      const hidden = wanted.filter((t) => !seen.has(lower(t)));
      databases.push({
        name: group.name,
        ...(group.catalog ? { catalog: group.catalog } : {}),
        listings: wanted.length,
        visible: hidden.length === 0 ? 'all' : hidden.length === wanted.length ? 'none' : 'some',
        hiddenTables: hidden.slice(0, MAX_NAMED),
      });
    } catch (error: any) {
      const name = String(error?.name ?? '');
      const denied = /EntityNotFound|AccessDenied/.test(name);
      databases.push({
        name: group.name,
        ...(group.catalog ? { catalog: group.catalog } : {}),
        listings: wanted.length,
        visible: denied ? 'none' : 'unknown',
        hiddenTables: denied ? wanted.slice(0, MAX_NAMED) : [],
        error: denied
          ? 'The role cannot see this database at all'
          : (error?.message ?? 'The catalog could not be read'),
      });
    }
  }

  const byCatalog = new Map<string, string[]>();
  for (const database of databases) {
    if (database.visible === 'all' || database.visible === 'unknown') {
      continue;
    }
    const key = database.catalog ?? '';
    byCatalog.set(key, [...(byCatalog.get(key) ?? []), database.name]);
  }
  const commands = [...byCatalog.entries()].map(
    ([catalog, names]) =>
      `just athena-grant "${names.join(',')}"${catalog ? ` catalog=${catalog}` : ''}`
  );
  const awsCli = [...byCatalog.entries()].flatMap(([catalog, names]) =>
    names.flatMap((name) => grantCommands(role, name, catalog || undefined))
  );
  return { role, databases, commands, awsCli };
}

/** DESCRIBE on the database, then SELECT and DESCRIBE on every table in it, as the CLI takes them. */
function grantCommands(role: string, database: string, catalog?: string): string[] {
  const principal = `--principal DataLakePrincipalIdentifier=${role}`;
  const id = catalog ? `"CatalogId":"${catalog}",` : '';
  return [
    `aws lakeformation grant-permissions ${principal} --permissions DESCRIBE --resource '{"Database":{${id}"Name":"${database}"}}'`,
    `aws lakeformation grant-permissions ${principal} --permissions SELECT DESCRIBE --resource '{"Table":{${id}"DatabaseName":"${database}","TableWildcard":{}}}'`,
  ];
}

function lower(value: string): string {
  return value.toLowerCase();
}
