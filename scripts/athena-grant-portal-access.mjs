#!/usr/bin/env node
/**
 * Let the portal's Lambda role read Lake Formation-governed tables through
 * Athena, so a custom SQL dataset's columns can be read before it is made.
 *
 * Lake Formation hides a table from a principal that has no grant on it:
 * Athena then reports TABLE_NOT_FOUND rather than access denied. Every
 * table SMUS publishes is governed this way. The Lambda cannot grant
 * itself, so this runs once per database with a data lake admin's AWS
 * credentials:
 *
 *   1. DESCRIBE on the database
 *   2. SELECT and DESCRIBE on every table in it (a table wildcard, so
 *      tables published later are covered)
 *
 * Usage:
 *   node scripts/athena-grant-portal-access.mjs --databases published_prod[,published_dev]
 *        [--catalog 123456789012] [--region us-east-1]
 *        [--role-arn arn:aws:iam::123:role/...] [--stack QuicksightPortalStack] [--dry-run]
 *
 * Without --role-arn the role is read from the CDK stack's LambdaExecutionRole.
 * --catalog is the Glue catalog id (the account by default); a federated or
 * Lakehouse catalog takes its own id. Uses the AWS CLI so it works with
 * whatever profile/SSO session you have. Granting again is harmless.
 */
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) =>
      a.startsWith('--')
        ? [
            a.slice(2),
            all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1],
          ]
        : null
    )
    .filter(Boolean)
);
const region = args.region ?? process.env.AWS_REGION ?? 'us-east-1';
const stack = args.stack ?? 'QuicksightPortalStack';
const dryRun = args['dry-run'] === 'true';
const databases = (args.databases ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (databases.length === 0) {
  console.error('Usage: --databases db1[,db2] is required');
  process.exit(2);
}

function aws(...cli) {
  const out = execFileSync('aws', [...cli, '--region', region, '--output', 'json'], {
    encoding: 'utf8',
  });
  return out.trim() ? JSON.parse(out) : {};
}

function roleArn() {
  if (args['role-arn']) return args['role-arn'];
  // CDK suffixes logical ids with a hash (LambdaExecutionRole7E2A4D6C), so
  // match the prefix among the stack's IAM roles rather than the exact id.
  const listed = aws('cloudformation', 'list-stack-resources', '--stack-name', stack);
  const roles = (listed.StackResourceSummaries ?? []).filter(
    (r) => r.ResourceType === 'AWS::IAM::Role'
  );
  const match =
    roles.find((r) => r.LogicalResourceId.startsWith('LambdaExecutionRole')) ?? roles[0];
  if (!match?.PhysicalResourceId) {
    throw new Error(
      `No IAM role found in stack ${stack} (roles: ${roles.map((r) => r.LogicalResourceId).join(', ') || 'none'}); pass --role-arn`
    );
  }
  return aws('iam', 'get-role', '--role-name', match.PhysicalResourceId).Role.Arn;
}

function grant(principal, permissions, resource) {
  const cli = [
    'lakeformation',
    'grant-permissions',
    '--principal',
    JSON.stringify({ DataLakePrincipalIdentifier: principal }),
    '--permissions',
    ...permissions,
    '--resource',
    JSON.stringify(resource),
  ];
  if (dryRun) {
    console.log(`  would run: aws ${cli.join(' ')}`);
    return;
  }
  aws(...cli);
}

const principal = roleArn();
const catalog = args.catalog ? { CatalogId: args.catalog } : {};
console.log(
  `Granting ${principal} in Lake Formation${args.catalog ? ` (catalog ${args.catalog})` : ''}:`
);
for (const database of databases) {
  console.log(`- ${database}: DESCRIBE on the database, SELECT and DESCRIBE on every table`);
  grant(principal, ['DESCRIBE'], { Database: { ...catalog, Name: database } });
  grant(principal, ['SELECT', 'DESCRIBE'], {
    Table: { ...catalog, DatabaseName: database, TableWildcard: {} },
  });
}
console.log(
  dryRun
    ? 'Dry run: nothing granted.'
    : 'Done. A custom SQL dataset preview over these tables now reads its columns through Athena.'
);
