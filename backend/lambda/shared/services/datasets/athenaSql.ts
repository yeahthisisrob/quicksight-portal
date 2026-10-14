/**
 * A Glue catalog id is the account number. A SMUS listing names its table
 * with it, a QuickSight relational table accepts it, and Athena SQL does
 * not: Athena knows a catalog only by name (AwsDataCatalog by default), so
 * `"123456789012"."db"."table"` fails with "catalog does not exist". A
 * model that read the listing copies the id into its query every time, so
 * the query is corrected here rather than refused.
 */

/** `"123456789012".` or `123456789012.` in front of a two-part table name. */
const GLUE_CATALOG_PREFIX =
  /(^|[^\w."`'])"?(\d{12})"?\.(?=(?:"[^"]+"|`[^`]+`|[\w-]+)\.(?:"[^"]+"|`[^`]+`|[\w-]+))/g;

/** The query without any Glue catalog id in front of a table, and whether one was there. */
export function stripGlueCatalogIds(sql: string): { sql: string; stripped: boolean } {
  let stripped = false;
  const out = sql.replace(GLUE_CATALOG_PREFIX, (_match, before: string) => {
    stripped = true;
    return before;
  });
  return { sql: out, stripped };
}
