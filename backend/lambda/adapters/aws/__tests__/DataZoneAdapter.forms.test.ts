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
    const parsed = parseListingForms(forms);
    expect(parsed).toMatchObject({
      table: { catalog: '123456789012', database: 'published_prod', name: 'dim_customer' },
      columns: [
        { name: 'customer_id', type: 'bigint' },
        { name: 'name', type: 'string' },
      ],
    });
    // Every form is also flattened for display; the column list is left out.
    expect(parsed.forms?.map((f) => f.name)).toEqual(['GlueTableForm', 'RelationalTableForm']);
    expect(parsed.forms?.[1]).toEqual({
      name: 'RelationalTableForm',
      fields: [{ key: 'tableName', value: 'dim_customer' }],
    });
  });

  it('accepts explicit database fields and tolerates unknown form names', () => {
    const forms = JSON.stringify({
      'amazon.datazone.GlueTableFormType': { databaseName: 'gold-dev', tableName: 'fct_orders' },
      SomethingElse: { x: 1 },
    });
    expect(parseListingForms(forms)).toMatchObject({
      table: { catalog: undefined, database: 'gold-dev', name: 'fct_orders' },
      columns: undefined,
      forms: [
        {
          name: 'amazon.datazone.GlueTableFormType',
          fields: [
            { key: 'databaseName', value: 'gold-dev' },
            { key: 'tableName', value: 'fct_orders' },
          ],
        },
        { name: 'SomethingElse', fields: [{ key: 'x', value: '1' }] },
      ],
    });
  });

  it('returns nothing for missing or malformed forms', () => {
    expect(parseListingForms(undefined)).toEqual({});
    expect(parseListingForms('not json')).toEqual({});
    expect(parseListingForms(JSON.stringify({ GlueTableForm: {} }))).toEqual({
      table: undefined,
      columns: undefined,
      forms: [],
    });
  });
});
