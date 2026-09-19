/**
 * Version stamp for exported asset metadata. Bump whenever parsers start
 * extracting NEW fields from asset definitions (lineage table names/schemas,
 * custom-SQL table refs, ...): Smart Sync compares only lastUpdatedTime, so
 * without this stamp, assets whose QuickSight definitions haven't changed
 * would never be re-parsed and new metadata would stay missing forever.
 *
 * Cached entries with an older (or absent) parserVersion are treated as
 * needing re-export by AssetComparisonService.
 *
 * v2: dataset lineage physical tables carry name/schema/catalog and
 *     custom-SQL table refs (sqlTables) for the Schema column and SMUS
 *     catalog matching.
 * v3: composite dataset support - dataset lineage carries datasetIds/
 *     datasetArns extracted from LogicalTableMap Source.DataSetArn and
 *     PhysicalTableMap DataSetArn, powering dataset->dataset uses/used_by.
 * v4: the new data prep experience - calculated fields, renames, type casts
 *     and parent datasets are read from DataPrepConfiguration as well as from
 *     LogicalTableMap. Datasets built there parsed as having no calculated
 *     fields at all until they are read again.
 */
export const PARSER_METADATA_VERSION = 4;
