/**
 * Friendly display names for QuickSight datasource types (the DataSource
 * API's Type field). Shared by table cells (plain text) and
 * DatasourceTypeBadge (dialog badge contexts).
 */
const DATASOURCE_TYPE_LABELS: Record<string, string> = {
  AMAZONELASTICSEARCH: 'Elasticsearch',
  ATHENA: 'Athena',
  AURORA: 'Aurora',
  AURORA_POSTGRESQL: 'Aurora PG',
  MARIADB: 'MariaDB',
  MYSQL: 'MySQL',
  POSTGRESQL: 'PostgreSQL',
  PRESTO: 'Presto',
  REDSHIFT: 'Redshift',
  S3: 'S3',
  SNOWFLAKE: 'Snowflake',
  SPARK: 'Spark',
  SQLSERVER: 'SQL Server',
  TERADATA: 'Teradata',
  TIMESTREAM: 'Timestream',
  TWITTER: 'Twitter',
  BIGQUERY: 'BigQuery',
  DATABRICKS: 'Databricks',
  FILE: 'File',
  COMPOSITE: 'Composite',
  'Custom SQL': 'SQL',
  'Uploaded File': 'File',
  Database: 'Database',
  Unknown: 'Unknown',
  UNKNOWN: 'Unknown',
};

export function formatDatasourceType(type: string): string {
  return DATASOURCE_TYPE_LABELS[type] || type;
}
