# QuickSight Assets Portal

[![Release](https://img.shields.io/github/v/release/yeahthisisrob/quicksight-portal)](https://github.com/yeahthisisrob/quicksight-portal/releases)
[![Build](https://github.com/yeahthisisrob/quicksight-portal/actions/workflows/build.yml/badge.svg)](https://github.com/yeahthisisrob/quicksight-portal/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hosted portal for Amazon QuickSight that goes past inventory: it can **author**. Describe a change in plain language, watch a hybrid planner turn it into a validated plan, see the result as a wireframe before anything is written, then publish a copy or an in-place update. Underneath sits the full admin toolset: every dashboard, analysis, dataset, data source, folder, user and group in the account, with lineage, activity analytics, safe export and restore, and a growing SageMaker Unified Studio integration. Deploys into your own AWS account with one CDK command.

![Author: the mockup step](docs/screenshots/author-mockup.png)

## Features

### Author: the way dashboards get made

Author is built for the people who make dashboards and analyses all day. Start from something that already works, change it with clicks or with words, see the result before it exists, then publish it into the right folder with the right audience.

1. **Source** - dashboards and analyses ranked by real use: templates first, then the most viewed, with views, viewers, last-viewed dates, and an insights card for the selected one. Dashboards with QuickSight CloudWatch metrics show their p90 load time, and visuals that are slow or erroring are flagged on the preview so nobody clones a broken one.
2. **Datasets** - for each dataset the definition reads, choose what it should read instead, scoped by SMUS project: a **published SMUS asset** (with the QuickSight datasets already reading it, or create one in place through an existing data source), or any QuickSight dataset.
3. **Describe & review** - type what you want, or fill the form by hand. Every referenced column is resolved against the target as matched, renamed, suggested or missing; suggestions are never applied silently. Add calculated fields from the template library.
4. **Mockup and edit** - a before/after wireframe of the exact definition that would be written. Click any visual to retitle it, change its type (bar, column, line, pie, donut, table, pivot), move and resize it on the grid, duplicate or remove it, rename sheets. Every edit is a validated operation, listed in plain English, highlighted on the wireframe.
5. **Publish** - a summary of every change, a folder to publish into, then create the copy (keeping the source's theme and permissions) or apply in place. "Open in QuickSight" to fine-tune, or start another from the result.

![Author: sources ranked by use, with insights and flagged visuals](docs/screenshots/author-source.png)

![Author: choosing targets from published SMUS assets](docs/screenshots/author-targets.png)

![Author: the mockup editor with the inspector and the change list](docs/screenshots/author-mockup.png)

![Author: publish with every change spelled out and a folder to land in](docs/screenshots/author-publish.png)

### The planner: a model proposes, code decides

The natural-language part is deliberately small. The model is asked up to three narrow questions, each answered as JSON against a flat schema:

- which candidate dataset each identifier should read from, and whether this is a copy or an in-place change;
- only if the server's dry run leaves columns unresolved, which target column each unresolved source column means;
- only if the ask mentions layout or visuals, which edit operations to make, expressed against a sheet outline with real ids. Each proposed operation is applied to a preview first; one that fails validation is dropped, never sent.

Everything else is deterministic TypeScript: what the definition references, whether the target satisfies it, the rewrite itself. The planner's answer is validated, run through the same dry run the UI shows, and returned as a proposal. **Nothing is applied by the model.** A person, a CLI, or an agent reads the plan and calls apply.

The model interface is one call, prompt in and JSON out, which keeps it model-agnostic:

| Provider | Use |
|---|---|
| **Amazon Bedrock** (Converse API) | Production. Any Bedrock model with tool use; cross-region inference profiles by default. Your data never leaves your account. |
| Local **Claude** or **Codex** CLI | Development. The planner runs through your own logged-in CLI with no cloud credentials. Never used inside Lambda. |
| Any **OpenAI-compatible** endpoint | Grok, OpenAI, or a gateway, via `PLANNER_BASE_URL`. |

The provider and model are settings, not a redeploy.

### Wireframes

Any dashboard or analysis renders as a wireframe from its cached definition: sheets, every visual as a card in its real grid, free-form or paginated position, the visual type, its title, and its field wells. Close to QuickSight's look without pretending to be it, and never showing data. The same renderer draws the Author mockup.

![Wireframe of a dashboard](docs/screenshots/wireframe-dialog.png)

### SageMaker Unified Studio

The portal reads the published catalog of a SMUS (DataZone) domain: each listing with its owning project, its Glue table and columns from the listing's metadata forms, and the QuickSight datasets already reading it. Settings choose which projects count and, optionally, a database-name pattern for the published layer. From a listing with no dataset yet, the portal can create one through an existing data source, copying permissions from a reference dataset so it has an audience. This is the direction the portal is heading: more of what you do here will start from what SMUS publishes.

**Exported, not live.** Like QuickSight, SMUS is read by an export job, never on a page request. The SMUS export (Operations page, or `POST /api/smus/export`) sweeps the domain once, scoped to the projects selected in Settings, and writes one snapshot to the cache bucket: projects, listings with their forms and columns, and how the sweep went, including which IAM role called DataZone and whether the domain knows it. Settings, Author and the catalog read that snapshot, so a page load costs one cached read rather than a DataZone sweep, and the export's own card says when it ran, what it captured and, when the project list is empty, exactly why. The snapshot is one S3 object rather than DynamoDB items because it is read whole and its size grows with listings times columns times forms; jobs and settings, which are small records with atomic updates, stay in DynamoDB.

![Operations: the SMUS export](docs/screenshots/operations-smus.png)

### Catalog: SMUS first, QuickSight on top

The catalog shows only assets published in the SMUS projects chosen in Settings, one project at a time, since everything in SMUS is per project. SMUS owns the business metadata and the portal shows it read-only: glossary terms, metadata forms, descriptions, the Glue table and its columns. The portal adds what only QuickSight knows:

- the datasets reading each published asset, and their fields;
- calculated fields with their expressions, lineage in both directions (what an expression reads, and which calculated fields read it), and a clickable lineage graph;
- where every field is used, down to the visual (recorded by the QuickSight export as it parses each definition, so after upgrading run a cache rebuild once to fill it in);
- **conflicts**: the same calculated field defined with different expressions across dashboards and analyses, with each variant's sources, so a person can decide which is canonical;
- a link back to the SMUS column for plain fields, and a portal note only for calculated fields, because SMUS has no home for those;
- a **template library** of calculated fields. Save one from the catalog and Author adds it to the copies it creates.

![Catalog](docs/screenshots/catalog.png)

**Giving the portal a seat in the domain.** DataZone scopes project listing (and, in a locked-down domain, catalog reads) to principals that belong to the domain. Run this once with your admin credentials to register the portal's Lambda role and add it, read-only, to the projects it should read:

```bash
just smus-grant dzd_xxxx                          # every project
just smus-grant dzd_xxxx "analytics_prod,analytics_dev"
```

Author and the catalog are built on SMUS projects, so until a domain is set, at least one project is selected under "Projects to read from", and an export has run, each page shows one thing: what to do next, with a link to Settings or Operations. The picker itself explains an empty list: which export it read, which role called DataZone, whether the domain knows it, and how many projects, listings and publishers were found.

### Settings

Configuration lives in DynamoDB with a fallback to the Lambda's environment variables, so a fresh deployment works from env alone and values move over one at a time. Every setting shows where its value comes from. Secrets stay in the environment.

![Settings](docs/screenshots/settings.png)

### Asset management
- **Full inventory** of dashboards, analyses, datasets, data sources, folders, users, and groups with server-side search, sorting, and pagination
- **Change datasets** from any dashboard or analysis row, with the same plan-then-apply flow as Author
- **Edit dataset sources** in place: schema, table, custom SQL, data source
- **Smart Sync export engine** - incremental exports that only touch assets that changed in QuickSight; if the cache is lost it self-heals by re-parsing existing S3 exports with zero API calls
- **Resumable long runs** - exports checkpoint their progress and continue across Lambda invocations; only one export runs at a time (enforced by an atomic DynamoDB lock)
- **Operations** - the QuickSight export console, the SMUS export, archived assets with restore, and maintenance scripts on one page, in the same design system as the rest of the portal

![Operations](docs/screenshots/operations.png)
- **Bulk operations** - tag, folder-membership, and delete operations across selections, with per-item results
- **CSV export** of any asset listing

### Insight & governance
- **Data lineage** - dataset, data source and dashboard/analysis relationships, including composite datasets and transitive dependencies
- **Activity analytics** - CloudTrail-derived view counts and viewer history, dataset refresh history, per-user activity
- **Health from CloudWatch** - the Dashboards list shows 30-day views, p90 view load time and visual load errors; the Datasets list shows refresh runs, p90 ingestion latency and error rows. One batched CloudWatch read per page, from the metrics QuickSight publishes (Enterprise edition); accounts without them see "no metrics" rather than empty columns

![Dashboards with health columns](docs/screenshots/health-dashboards.png)
- **Tags & permissions** - browse and edit tags, inspect asset permissions, filter any asset page by a user's access

![Portal layout](docs/screenshots/layout.png)

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + MUI on a token-based design system (Cloudscape-inspired, light and dark), organized by [Feature-Sliced Design](https://feature-sliced.design/), every component in Storybook |
| Planner | Amazon Bedrock (Converse, forced tool call for structured output) by default; local Claude/Codex CLI or any OpenAI-compatible endpoint behind the same one-call interface |
| Backend | Node.js 22 Lambda (TypeScript), organized by Vertical Slice Architecture |
| API | HTTP API (API Gateway v2) behind CloudFront (same-origin), contract-first via OpenAPI |
| Auth | Cognito user pool; JWT verified in-Lambda on every route; optional WAF + IP allowlist at the edge |
| Jobs | **DynamoDB** — per-job records, item-per-line logs, atomic heartbeats, TTL retention, conditional-write export lock; SQS + worker Lambda with a self-requeuing continuation pattern for long runs |
| Asset data | **S3** — exported asset definitions (source of truth), per-type caches with ETag-revalidated in-memory reads, pre-computed catalog/lineage/field indexes |
| Infrastructure | AWS CDK with [cdk-nag](https://github.com/cdklabs/cdk-nag) (AWS Solutions rules) enforced on every synth |

### How authoring works

1. `GET /api/authoring/{type}/{id}/datasets` reads the definition live and lists every column it takes from each dataset identifier (field wells, filters, parameters, controls, formatting, calculated-field expressions).
2. `POST .../rebind/plan` resolves those columns against the target dataset's output columns. Nothing is written.
3. `POST .../propose` is the planner: the ask plus the candidates in, a validated proposal plus the same plan out.
4. `POST .../rebind/preview` returns the rewritten definition for the mockup.
5. `POST .../rebind` re-plans, refuses unless every column resolves, then creates the copy or updates in place.

Every step is an ordinary authenticated API call, so the same flow is available to the UI, a script, or an agent.

### How an export works

1. The API creates a job record (DynamoDB) and enqueues a message (SQS) — the UI starts polling immediately.
2. The worker Lambda acquires the single-export lock, lists assets from QuickSight, and compares against the cache: changed assets are re-exported, assets exported under an older parser version are re-parsed locally (zero API calls), everything else is skipped.
3. Every log line, progress update, and checkpoint is an atomic DynamoDB write that doubles as a heartbeat — a dead worker is auto-failed within 30 minutes, never leaving a stuck job.
4. If the run approaches the Lambda time limit, it checkpoints and requeues itself; a fresh invocation resumes exactly where it stopped.
5. When all asset types finish, the derived caches (field catalog, lineage, list snapshots) rebuild once.

## Prerequisites

- [mise](https://mise.jdx.dev) - installs everything else (Node, pnpm, just,
  lefthook, gitleaks) at the versions pinned in `mise.toml`:
  `curl https://mise.run | sh`
- AWS account with QuickSight (Enterprise edition recommended for full API coverage)
- AWS CLI configured with credentials
- Docker Desktop *(only for local development with SAM Local)*

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/yeahthisisrob/quicksight-portal.git
   cd quicksight-portal
   just install
   ```
   `just install` uses [mise](https://mise.jdx.dev) to fetch the exact Node,
   pnpm, lefthook and gitleaks versions pinned in `mise.toml`, installs the
   workspace with pnpm, and registers the git hooks. If you do not have mise
   or just yet: `curl https://mise.run | sh && mise install && mise exec -- just install`.

2. **Point at your AWS account**
   ```bash
   export CDK_DEFAULT_ACCOUNT=your-aws-account-id
   export CDK_DEFAULT_REGION=us-east-1
   # or: export AWS_PROFILE=your-profile-name
   ```

3. **Deploy**
   ```bash
   just synth              # review what will be created
   pnpm run cdk:bootstrap  # first time only
   just deploy             # checks, builds, then deploys the stack
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

Everything runs through [just](https://just.systems) (`just --list` for the full
set). Recipes go through `mise exec`, so the pinned toolchain is used whether or
not mise is activated in your shell.

```bash
just install      # one-time: toolchain, dependencies, git hooks
just dev          # SAM Local API (:3000) + Vite (:5173) + watchers
just check        # what CI runs: lint, typecheck, tests, architecture rules
just fix          # apply every safe formatting and lint fix
just storybook    # component workshop (:6006)
```

Before first run, copy the local config templates and fill in your account
details / CDK outputs:

```bash
cp frontend/public/config.js.example frontend/public/config.js
cp sam/template.yaml.example sam/template.yaml
cp sam/env.example.json sam/env.json
```

### Toolchain

| Concern | Tool | Config |
| --- | --- | --- |
| Tool versions | mise | `mise.toml`, `mise.lock` |
| Packages | pnpm workspace | `pnpm-workspace.yaml`, one `pnpm-lock.yaml` |
| Format + lint | Biome | `biome.jsonc` |
| Tasks | just | `justfile` |
| Git hooks | lefthook | `lefthook.yml` |
| Secrets | gitleaks | `.gitleaksignore` |

Biome replaced ESLint and Prettier: it formats and lints the whole repo in about
150ms, and it also enforces the architecture. The backend's Vertical Slice rules
(only the adapter layer may touch the QuickSight SDK) and the frontend's
Feature-Sliced rules (a layer may import only from layers below it, through their
public APIs) live in the `overrides` section of `biome.jsonc`.

A linter that silently stops matching still reports success, so
`scripts/verify-architecture-rules.mjs` writes deliberate violations at the real
paths those rules target and asserts each one is caught. It runs in `just check`
and in CI.

Use `pnpm`, never `npm` - a stray `npm install` creates a second lockfile and
reintroduces exactly the version drift the workspace removes.

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

- `/api/authoring/*` - definition datasets, plan, preview (with edit ops and plain-language changes), propose (planner), apply, insights
- `/api/smus/assets` - published SMUS assets with their linked datasets; create a dataset from one
- `/api/settings` - stored settings with their sources; the SMUS project list
- `/api/data-catalog/smus` - the SMUS-first catalog; `/api/data-catalog/templates/calculated-fields` - the template library
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
- The planner never writes to QuickSight: model output is validated as untrusted data and only reaches the apply step through the same plan a person reviews; Bedrock keeps prompts and definitions inside your account

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
