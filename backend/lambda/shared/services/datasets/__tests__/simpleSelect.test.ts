import { describe, expect, it } from 'vitest';

import { parseSimpleSelect } from '../simpleSelect';

describe('parseSimpleSelect', () => {
  it('reads a plain projection of one table, with aliases, quotes and a filter', () => {
    expect(
      parseSimpleSelect(
        '-- latest\nSELECT customer_id, "signed_up" AS signup_date, t.region region\nFROM "AwsDataCatalog".published_prod.dim_customer t WHERE region = \'EU\' ORDER BY 1 LIMIT 100;'
      )
    ).toEqual({
      table: 'awsdatacatalog.published_prod.dim_customer',
      columns: [
        { source: 'customer_id', name: 'customer_id' },
        { source: 'signed_up', name: 'signup_date' },
        { source: 'region', name: 'region' },
      ],
    });
    expect(parseSimpleSelect('select * from published_prod.fct_orders')).toEqual({
      table: 'published_prod.fct_orders',
      columns: '*',
    });
  });

  it('leaves anything it cannot type to the engine', () => {
    for (const sql of [
      'select count(*) as n from db.t',
      'select a, b from db.t join db.u on t.id = u.id',
      'select a from (select a from db.t)',
      'select a from t',
      'select a from db.t where id in (select id from db.u)',
      'with x as (select 1) select * from x',
      'select a, upper(b) from db.t',
      'select a from db.t union select a from db.u',
    ]) {
      expect(parseSimpleSelect(sql), sql).toBeUndefined();
    }
  });
});
