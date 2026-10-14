import { describe, expect, it } from 'vitest';

import { athenaAccessReport, roleArnFromCaller } from '../athenaAccess';

const listing = (database: string, name: string, catalog?: string) => ({
  table: { database, name, ...(catalog ? { catalog } : {}) },
});

describe('athenaAccess', () => {
  it('turns the caller identity into the role to grant', () => {
    expect(
      roleArnFromCaller(
        'arn:aws:sts::123456789012:assumed-role/PortalLambdaRole-ABC/quicksight-portal'
      )
    ).toBe('arn:aws:iam::123456789012:role/PortalLambdaRole-ABC');
    expect(roleArnFromCaller('arn:aws:iam::123456789012:role/Other')).toBe(
      'arn:aws:iam::123456789012:role/Other'
    );
  });

  it('reports each database by what the role can see, and the command for the rest', async () => {
    const glue = {
      async listTableNames(database: string) {
        if (database === 'published_prod') return ['dim_customer', 'FCT_ORDERS'];
        if (database === 'published_dev') return ['dim_customer'];
        if (database === 'restricted') {
          throw Object.assign(new Error('Database not found'), { name: 'EntityNotFoundException' });
        }
        throw new Error('Glue is unreachable');
      },
    };
    const report = await athenaAccessReport(
      [
        listing('published_prod', 'dim_customer'),
        listing('published_prod', 'fct_orders', 'AwsDataCatalog'),
        listing('published_dev', 'dim_customer'),
        listing('published_dev', 'fct_orders'),
        listing('restricted', 'secrets'),
        listing('lakehouse_db', 'events', '999999999999'),
        { table: undefined },
      ],
      glue,
      'arn:aws:iam::1:role/portal'
    );
    expect(report.databases).toEqual([
      {
        name: 'lakehouse_db',
        catalog: '999999999999',
        listings: 1,
        visible: 'unknown',
        hiddenTables: [],
        error: 'Glue is unreachable',
      },
      { name: 'published_dev', listings: 2, visible: 'some', hiddenTables: ['fct_orders'] },
      { name: 'published_prod', listings: 2, visible: 'all', hiddenTables: [] },
      {
        name: 'restricted',
        listings: 1,
        visible: 'none',
        hiddenTables: ['secrets'],
        error: 'The role cannot see this database at all',
      },
    ]);
    expect(report.commands).toEqual(['just athena-grant "published_dev,restricted"']);
    expect(report.awsCli).toEqual([
      `aws lakeformation grant-permissions --principal DataLakePrincipalIdentifier=arn:aws:iam::1:role/portal --permissions DESCRIBE --resource '{"Database":{"Name":"published_dev"}}'`,
      `aws lakeformation grant-permissions --principal DataLakePrincipalIdentifier=arn:aws:iam::1:role/portal --permissions SELECT DESCRIBE --resource '{"Table":{"DatabaseName":"published_dev","TableWildcard":{}}}'`,
      `aws lakeformation grant-permissions --principal DataLakePrincipalIdentifier=arn:aws:iam::1:role/portal --permissions DESCRIBE --resource '{"Database":{"Name":"restricted"}}'`,
      `aws lakeformation grant-permissions --principal DataLakePrincipalIdentifier=arn:aws:iam::1:role/portal --permissions SELECT DESCRIBE --resource '{"Table":{"DatabaseName":"restricted","TableWildcard":{}}}'`,
    ]);
  });

  it('separates the command per catalog and gives none when everything is visible', async () => {
    const everything = {
      async listTableNames() {
        return ['t'];
      },
    };
    const clean = await athenaAccessReport([listing('db', 't')], everything, 'role');
    expect(clean.commands).toEqual([]);
    const nothing = {
      async listTableNames() {
        return [];
      },
    };
    const split = await athenaAccessReport(
      [listing('a', 't'), listing('b', 't', '999999999999')],
      nothing,
      'role'
    );
    expect(split.commands).toEqual([
      'just athena-grant "a"',
      'just athena-grant "b" catalog=999999999999',
    ]);
    expect(split.awsCli[2]).toContain('"CatalogId":"999999999999","Name":"b"');
    expect(clean.awsCli).toEqual([]);
  });
});
