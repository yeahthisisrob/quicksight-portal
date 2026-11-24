/**
 * A Glue table's text, read and written. A column's comment is its
 * description and the table's description is its own; Glue has nowhere for a
 * business name.
 *
 * A write changes the comments and the description and nothing else: names,
 * types, the storage descriptor, the parameters (an Iceberg table's
 * `metadata_location` among them) are sent back as they were read.
 */
import type { Column, Table, TableInput } from '@aws-sdk/client-glue';

import { type FieldWrite, type Shown, TABLE_KEY } from '../types';

/** A Data Catalog view is recreated from its SQL by whoever publishes it; never written here. */
export const isGlueView = (table: Table): boolean => Boolean(table.ViewDefinition);

export function glueShown(
  table: Pick<Table, 'StorageDescriptor' | 'PartitionKeys' | 'Description'>
): Shown {
  const shown: Shown = {};
  for (const column of [
    ...(table.StorageDescriptor?.Columns ?? []),
    ...(table.PartitionKeys ?? []),
  ]) {
    if (column.Name) {
      shown[column.Name] = column.Comment ? { description: column.Comment } : {};
    }
  }
  shown[TABLE_KEY] = table.Description ? { description: table.Description } : {};
  return shown;
}

/** The table as an UpdateTable input with the descriptions written in. */
export function glueTableInput(table: Table, writes: readonly FieldWrite[]): TableInput {
  const comments = new Map(
    writes
      .filter((w) => w.field === 'description' && w.key !== TABLE_KEY)
      .map((w) => [w.key, w.value])
  );
  const described = (column: Column): Column => {
    const comment = column.Name ? comments.get(column.Name) : undefined;
    return comment === undefined ? column : { ...column, Comment: comment };
  };
  const description = writes.find((w) => w.field === 'description' && w.key === TABLE_KEY)?.value;
  const storage = table.StorageDescriptor;
  return {
    Name: table.Name,
    Description: description ?? table.Description,
    Owner: table.Owner,
    Retention: table.Retention,
    StorageDescriptor: storage
      ? { ...storage, Columns: (storage.Columns ?? []).map(described) }
      : undefined,
    PartitionKeys: table.PartitionKeys ? table.PartitionKeys.map(described) : undefined,
    ViewOriginalText: table.ViewOriginalText,
    ViewExpandedText: table.ViewExpandedText,
    TableType: table.TableType,
    Parameters: table.Parameters,
    TargetTable: table.TargetTable,
  };
}
