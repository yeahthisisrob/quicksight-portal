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

  it('reads a form whose body is a JSON string, which is how SearchListings sends it', () => {
    const forms = JSON.stringify({
      GlueTableForm: JSON.stringify({
        tableArn: 'arn:aws:glue:us-east-1:1:table/published_prod/fct_orders',
      }),
      RelationalTableForm: JSON.stringify({
        columns: [
          { columnName: 'order_id', dataType: 'bigint', columnDescription: 'Natural key' },
          { columnName: 'amount', dataType: 'decimal' },
        ],
      }),
    });
    expect(parseListingForms(forms)).toMatchObject({
      table: { database: 'published_prod', name: 'fct_orders' },
      columns: [
        { name: 'order_id', type: 'bigint', description: 'Natural key' },
        { name: 'amount', type: 'decimal' },
      ],
    });
  });

  it('reads an array of form envelopes, content and all', () => {
    const forms = JSON.stringify([
      { formName: 'GlueTableForm', content: '{"databaseName":"gold","tableName":"dim_date"}' },
      {
        formName: 'RelationalTableForm',
        typeName: 'amazon.datazone.RelationalTableFormType',
        content: '{"columns":[{"columnName":"date_key","dataType":"date"}]}',
      },
    ]);
    expect(parseListingForms(forms)).toMatchObject({
      table: { database: 'gold', name: 'dim_date' },
      columns: [{ name: 'date_key', type: 'date' }],
    });
  });

  it('finds columns nested below the form body, and under other spellings', () => {
    const forms = JSON.stringify({
      SomeForm: {
        schema: { columns: [{ name: 'region', dataTypeName: 'varchar', comment: 'Sales region' }] },
      },
    });
    expect(parseListingForms(forms).columns).toEqual([
      { name: 'region', type: 'varchar', description: 'Sales region' },
    ]);
  });

  it('takes a form object that was never a string, and the longest column list it finds', () => {
    expect(
      parseListingForms({
        A: { columns: [{ columnName: 'one' }] },
        B: { columns: [{ columnName: 'one' }, { columnName: 'two' }] },
      }).columns
    ).toEqual([
      { name: 'one', type: '' },
      { name: 'two', type: '' },
    ]);
  });

  it('does not mistake a list of untyped named things for a schema', () => {
    const forms = JSON.stringify({
      OwnershipForm: { stewards: [{ name: 'Data team' }, { name: 'Finance' }] },
    });
    expect(parseListingForms(forms).columns).toBeUndefined();
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
