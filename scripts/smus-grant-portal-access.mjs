#!/usr/bin/env node
/**
 * Give the portal's Lambda role a seat in a SageMaker Unified Studio domain.
 *
 * DataZone scopes ListProjects (and, in a locked-down domain, catalog reads)
 * to principals that belong to the domain and its projects. The Lambda cannot
 * grant itself that, so this runs once with a domain admin's AWS credentials:
 *
 *   1. registers the role as a domain user (CreateUserProfile, IAM_ROLE)
 *   2. adds it to each chosen project (CreateProjectMembership), read-only by
 *      default (PROJECT_CATALOG_VIEWER)
 *
 * Usage:
 *   node scripts/smus-grant-portal-access.mjs --domain dzd_xxxx [--region us-east-1]
 *        [--projects name1,name2] [--role-arn arn:aws:iam::123:role/...]
 *        [--stack QuicksightPortalStack] [--designation PROJECT_CATALOG_VIEWER] [--dry-run]
 *
 * Without --projects every project in the domain is granted. Without
 * --role-arn the role is read from the CDK stack's LambdaExecutionRole.
 * Uses the AWS CLI so it works with whatever profile/SSO session you have.
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
const domain = args.domain;
const region = args.region ?? process.env.AWS_REGION ?? 'us-east-1';
const stack = args.stack ?? 'QuicksightPortalStack';
const designation = args.designation ?? 'PROJECT_CATALOG_VIEWER';
const dryRun = args['dry-run'] === 'true';
const wanted = args.projects
  ? args.projects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

if (!domain) {
  console.error('Usage: --domain dzd_xxxx is required');
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
  if (roles.length > 1) {
    console.log(
      `Roles in stack: ${roles.map((r) => r.LogicalResourceId).join(', ')} (using ${match.LogicalResourceId})`
    );
  }
  return aws('iam', 'get-role', '--role-name', match.PhysicalResourceId).Role.Arn;
}

function listProjects() {
  const items = [];
  let token;
  do {
    const page = aws(
      'datazone',
      'list-projects',
      '--domain-identifier',
      domain,
      '--max-results',
      '50',
      ...(token ? ['--next-token', token] : [])
    );
    items.push(...(page.items ?? []));
    token = page.nextToken;
  } while (token);
  return items;
}

const arn = roleArn();
console.log(`Role:     ${arn}`);
console.log(`Domain:   ${domain} (${region})`);
console.log(`Grant:    ${designation}${dryRun ? '  [dry run]' : ''}`);

// 1. domain user profile for the role
try {
  const existing = aws(
    'datazone',
    'get-user-profile',
    '--domain-identifier',
    domain,
    '--user-identifier',
    arn,
    '--type',
    'IAM'
  );
  console.log(`Profile:  already registered (${existing.status ?? 'ok'})`);
} catch {
  if (dryRun) {
    console.log('Profile:  would register the role as an IAM_ROLE domain user');
  } else {
    aws(
      'datazone',
      'create-user-profile',
      '--domain-identifier',
      domain,
      '--user-type',
      'IAM_ROLE',
      '--user-identifier',
      arn
    );
    console.log('Profile:  registered the role as an IAM_ROLE domain user');
  }
}

// 2. project memberships
const projects = listProjects();
const targets = wanted
  ? projects.filter((p) => wanted.includes(p.name) || wanted.includes(p.id))
  : projects;
const missing = wanted
  ? wanted.filter((w) => !projects.some((p) => p.name === w || p.id === w))
  : [];
for (const name of missing) console.log(`Project:  ${name}  NOT FOUND in the domain`);

for (const project of targets) {
  try {
    if (!dryRun) {
      aws(
        'datazone',
        'create-project-membership',
        '--domain-identifier',
        domain,
        '--project-identifier',
        project.id,
        '--designation',
        designation,
        '--member',
        `userIdentifier=${arn}`
      );
    }
    console.log(
      `Project:  ${project.name} (${project.id})  ${dryRun ? 'would add' : 'added'} as ${designation}`
    );
  } catch (error) {
    const text = String(error.stderr ?? error.message ?? error);
    if (/already|exists|ConflictException/i.test(text)) {
      console.log(`Project:  ${project.name} (${project.id})  already a member`);
    } else {
      console.log(`Project:  ${project.name} (${project.id})  FAILED: ${text.split('\n')[0]}`);
    }
  }
}
console.log(
  `Done: ${targets.length} project(s). The portal's project picker will show them on its next load.`
);
