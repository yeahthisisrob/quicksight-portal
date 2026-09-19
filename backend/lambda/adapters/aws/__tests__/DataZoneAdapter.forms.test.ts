import { describe, expect, it } from 'vitest';

import { parseListingForms } from '../DataZoneAdapter';

describe('parseListingForms', () => {
  it('reads table identity from the Glue table ARN and columns from the relational form', () => {
    const forms = JSON.stringify({
      GlueTableForm: {
        tableArn: 'arn:aws:glue:us-east-1:123456789012:table/published_prod/dim_customer',
        catalogId: '123456789012',
        region: 'us-east-1',
      },
      RelationalTableForm: {
        tableName: 'dim_customer',
        columns: [
          { columnName: 'customer_id', dataType: 'bigint' },
          { columnName: 'name', dataType: 'string' },
          { columnName: '', dataType: 'string' },
        ],
      },
    });
    expect(parseListingForms(forms)).toEqual({
      table: { catalog: '123456789012', database: 'published_prod', name: 'dim_customer' },
      columns: [
        { name: 'customer_id', type: 'bigint' },
        { name: 'name', type: 'string' },
      ],
    });
  });

  it('accepts explicit database fields and tolerates unknown form names', () => {
    const forms = JSON.stringify({
      'amazon.datazone.GlueTableFormType': { databaseName: 'gold-dev', tableName: 'fct_orders' },
      SomethingElse: { x: 1 },
    });
    expect(parseListingForms(forms)).toEqual({
      table: { catalog: undefined, database: 'gold-dev', name: 'fct_orders' },
      columns: undefined,
    });
  });

  it('returns nothing for missing or malformed forms', () => {
    expect(parseListingForms(undefined)).toEqual({});
    expect(parseListingForms('not json')).toEqual({});
    expect(parseListingForms(JSON.stringify({ GlueTableForm: {} }))).toEqual({
      table: undefined,
      columns: undefined,
    });
  });
});
