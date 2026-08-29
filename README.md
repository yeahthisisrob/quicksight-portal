# QuickSight Assets Portal

[![Release](https://img.shields.io/github/v/release/yeahthisisrob/quicksight-portal)](https://github.com/yeahthisisrob/quicksight-portal/releases)
[![Build](https://github.com/yeahthisisrob/quicksight-portal/actions/workflows/build.yml/badge.svg)](https://github.com/yeahthisisrob/quicksight-portal/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hosted admin portal for AWS QuickSight: inventory, search, and govern every dashboard, analysis, dataset, data source, folder, user, and group in your account — with data lineage, a field-level data catalog, activity analytics, and safe export/restore. Deploys into your own AWS account with a single CDK command.

## Features

### Asset management
- **Full inventory** of dashboards, analyses, datasets, data sources, folders, users, and groups with server-side search, sorting, and pagination
- **Smart Sync export engine** — incremental exports that only touch assets that changed in QuickSight; if the cache is lost it self-heals by re-parsing existing S3 exports with zero API calls
- **Resumable long runs** — exports checkpoint their progress and continue across Lambda invocations, so account size never hits the 15-minute wall; only one export runs at a time (enforced by an atomic DynamoDB lock)
- **Live job telemetry** — real-time progress, per-asset-type checkpoint chips, worker heartbeat/liveness indicator, and streaming job logs in the UI
- **Bulk operations** — tag, folder-membership, and delete operations across selections, with per-item results
- **Archive & restore** — deleted QuickSight assets are detected, archived with their full definitions, and restorable
- **CSV export** of any asset listing

### Insight & governance
- **Data lineage** — dataset ↔ data source ↔ dashboard/analysis relationships, including composite (dataset-of-datasets) lineage and transitive dependencies
- **Data catalog** — pre-computed, field-level catalog across datasets, analyses, and dashboards: physical/calculated fields, expressions, SQL table references, visual-field usage
- **Activity analytics** — CloudTrail-derived view counts and viewer history for dashboards/analyses, dataset refresh (ingestion) history, and per-user activity
- **SMUS / DataZone integration** *(optional)* — live catalog links from datasets to SageMaker Unified Studio listings via table-identity matching
- **Tags & permissions** — browse and edit tags, inspect asset permissions, filter any asset page by a user's access

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + MUI, organized by [Feature-Sliced Design](https://feature-sliced.design/) |
| Backend | Node.js 22 Lambda (TypeScript), organized by Vertical Slice Architecture |
| API | HTTP API (API Gateway v2) behind CloudFront (same-origin), contract-first via OpenAPI |
| Auth | Cognito user pool; JWT verified in-Lambda on every route; optional WAF + IP allowlist at the edge |
| Jobs | **DynamoDB** — per-job records, item-per-line logs, atomic heartbeats, TTL retention, conditional-write export lock; SQS + worker Lambda with a self-requeuing continuation pattern for long runs |
| Asset data | **S3** — exported asset definitions (source of truth), per-type caches with ETag-revalidated in-memory reads, pre-computed catalog/lineage/field indexes |
| Infrastructure | AWS CDK with [cdk-nag](https://github.com/cdklabs/cdk-nag) (AWS Solutions rules) enforced on every synth |

### How an export works

1. The API creates a job record (DynamoDB) and enqueues a message (SQS) — the UI starts polling immediately.
2. The worker Lambda acquires the single-export lock, lists assets from QuickSight, and compares against the cache: changed assets are re-exported, assets exported under an older parser version are re-parsed locally (zero API calls), everything else is skipped.
3. Every log line, progress update, and checkpoint is an atomic DynamoDB write that doubles as a heartbeat — a dead worker is auto-failed within 30 minutes, never leaving a stuck job.
4. If the run approaches the Lambda time limit, it checkpoints and requeues itself; a fresh invocation resumes exactly where it stopped.
5. When all asset types finish, the derived caches (field catalog, lineage, list snapshots) rebuild once.

## Prerequisites

- Node.js 22+ and npm
- AWS account with QuickSight (Enterprise edition recommended for full API coverage)
- AWS CLI configured with credentials
- Docker Desktop *(only for local development with SAM Local)*
- [Just](https://just.systems) command runner *(optional, for dev workflows)*

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/yeahthisisrob/quicksight-portal.git
   cd quicksight-portal
   npm run install:all
   ```

2. **Point at your AWS account**
   ```bash
   export CDK_DEFAULT_ACCOUNT=your-aws-account-id
   export CDK_DEFAULT_REGION=us-east-1
   # or: export AWS_PROFILE=your-profile-name
   ```

3. **Deploy**
   ```bash
   npm run cdk:bootstrap   # first time only
   npm run deploy:prod     # builds backend + frontend, deploys the stack
   ```
   The stack creates CloudFront + S3 (SPA), the API and worker Lambdas, Cognito, the SQS export queue + DLQ, and the DynamoDB jobs table. Outputs include the **SiteURL** — the portal is live there.

   Optional context flags: `-c enableWaf=false` (WAF is on by default), `-c allowedIpRanges='["1.2.3.4/32"]'` (edge IP allowlist), `-c smusDomainId=dzd_xxxx` (SMUS integration), `-c nag=false` (skip cdk-nag for a one-off synth).

4. **Create your first user**
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <UserPoolId from CDK output> \
     --username you@example.com \
     --user-attributes Name=email,Value=you@example.com

   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <UserPoolId from CDK output> \
     --username you@example.com \
     --group-name QuickSightUsers
   ```
   (Or use the Cognito console; add admins to the `Admins` group.)

5. **Run your first export** — sign in, open **Export Assets**, and start a **Smart Sync**. The portal populates itself from your QuickSight account.

## Development

### With Just (recommended)

```bash
just dev          # full dev environment with checks
just dev-quick    # faster startup, skip checks
just check        # lint + typecheck + tests (backend and frontend)
just backend      # SAM Local API only
just frontend     # Vite dev server only
```

### Without Just

```bash
# One-time local config
cp frontend/public/config.js.example frontend/public/config.js
cp sam/template.yaml.example sam/template.yaml
cp sam/env.example.json sam/env.json
# edit each with your account details / CDK outputs

npm run dev:api-only          # backend via SAM Local
cd frontend && npm run dev    # frontend
npm test                      # backend tests
npm run test:frontend         # frontend tests
cd frontend && npm run storybook   # component workshop
```

Local development talks to your real AWS account (S3, DynamoDB, QuickSight); the jobs table is created automatically on first use if it doesn't exist.

## Project Structure

```
├── frontend/                 # React SPA (Feature-Sliced Design)
│   └── src/
│       ├── app/  pages/  widgets/  features/  entities/  shared/
├── backend/lambda/           # Lambda code (Vertical Slice Architecture)
│   ├── features/             # vertical slices (data-export, activity, data-catalog, ...)
│   ├── shared/               # cross-slice services (cache, jobs, aws, parsing, lineage)
│   ├── index.ts              # API Lambda entrypoint
│   └── worker.ts             # SQS worker Lambda entrypoint
├── infrastructure/cdk/       # CDK stack (+ cdk-nag)
├── shared/schemas/           # OpenAPI spec (source of truth for API types)
└── sam/                      # SAM Local templates for local development
```

## API

Contract-first via OpenAPI: `shared/schemas/api.openapi.yaml` defines every endpoint; frontend types are generated from it (`shared/generated/types.ts`). Highlights:

- `/api/assets`, `/api/export/{assetType}/{assetId}` — asset listings and raw definitions
- `/api/export`, `/api/jobs/*` — export jobs, status, logs, results, stop
- `/api/lineage`, `/api/catalog` — lineage graph and field catalog
- `/api/activity/*` — views, viewers, ingestion history
- `/api/folders`, `/api/users`, `/api/groups`, `/api/tags` — organization and governance

## Security

- Cognito authentication; JWTs verified in the API Lambda on every request
- CloudFront same-origin API routing; WAF (managed rules) on by default with optional IP allowlisting at the edge
- Least-privilege IAM scoped to the metadata bucket, jobs table, and QuickSight; encrypted S3/SQS/DynamoDB
- **cdk-nag (AWS Solutions pack) fails synth on unreviewed findings** — every accepted deviation is acknowledged in the stack with a written reason
- CloudTrail-based activity auditing surfaced in the portal

## Troubleshooting

| Symptom | Check |
|---|---|
| Export stuck or slow | Job page shows worker heartbeat + per-type progress; a dead worker auto-fails within 30 min and the run can simply be restarted (Smart Sync resumes incrementally) |
| Empty portal after deploy | Run a Smart Sync export; check the worker Lambda's CloudWatch logs |
| Permission denied errors | Lambda execution role vs. QuickSight permissions; QuickSight must be active in the region |
| Cognito callback mismatch | The deployed config is wired automatically; for local dev, check `frontend/public/config.js` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases are automated with release-please (conventional commits); CI runs lint, typecheck, tests, and builds on every PR, and Dependabot keeps dependencies current.

## License

MIT — see [LICENSE](LICENSE).
