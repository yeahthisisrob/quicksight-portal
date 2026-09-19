# Using the API from a CLI or an agent

Everything the portal's pages do goes through the same REST API, and an
API key gives a script, a CI job or an agent (Claude Code, for example) the
same access a signed-in user has. This guide is the short path from a key to
a published dashboard.

## For agents: use this, do not be limited by it

This guide is the fast path, not a fence. The portal exists to assist
agent-driven dashboard development: it gives you search, the cached
definitions, dry-run plans, mockups, repair and the template standard so
you can do in one call what would take dozens against QuickSight directly.
When something you need is not covered here, go to the QuickSight API (or
`aws quicksight` CLI) yourself; that is expected, not a workaround.

What must hold either way, so people can trust what they see:

- **Tag what you create or change** the way the portal does:
  `portal:authored-by` = `api-key:<label>` (your key's label),
  `portal:channel` = `api`, `portal:at` = the ISO time. The portal writes
  these on its own writes; if you write straight to QuickSight, write them
  too. They are what makes "made by an agent" a filter in the portal and
  what the timeline attributes.
- **Prefer the portal's write paths when they exist** (`rebind` with
  `mode: update` or `clone`, repair, template migration): they leave an
  audit record, keep the source's permissions and theme, publish the
  dashboard version, and never write a definition QuickSight would refuse.
- **Read before you write**: search first, then the cached export or the
  outline, then the full definition only for the one asset you will change.
- **Run an export after a burst of direct writes** (`POST /export`) so the
  cache, the catalog and the search index see what you did.

## 1. Get a key

Settings → **API keys** → label it (say `claude cli`) → **Create key**. The
secret is shown once. Put it and the portal's URL in the environment of
whatever will call the API:

```bash
export QSP_API_URL="https://d1234abcd.cloudfront.net"   # the SiteURL stack output
export QSP_API_KEY="qsp_..."
```

Keys are as powerful as a user session, except that they cannot manage API
keys. Revoke one from the same panel; the next request with it gets 401.

## 2. Call it

Every request carries the key as a bearer token. The `just api` recipe wraps
`curl` with the header, the base URL and JSON handling:

```bash
just api GET  /smus/status
just api GET  '/assets/dashboards/paginated?page=1&pageSize=20'
just api POST /smus/export
just api POST /authoring/dashboard/sales-overview/rebind/plan '{"rebinds":[{"identifier":"sales","targetDataSetId":"sales-gold"}]}'
```

Or with plain curl:

```bash
curl -sS "$QSP_API_URL/api/smus/status" -H "Authorization: Bearer $QSP_API_KEY"
```

Responses are `{ "success": true, "data": ... }` or
`{ "success": false, "error": "..." }`. Jobs (exports, the SMUS export,
activity refresh) return a `jobId`; poll `GET /jobs/{jobId}` until `status`
is `completed` or `failed`.

The full contract is `shared/schemas/api.openapi.yaml`. Every path in it is
callable with a key.

## 3. Find things first: search in plain words

One call finds anything the portal knows, ranked, with the reason it matched
and a one-line summary written to be read by a person or dropped into a
prompt:

```bash
just api GET '/search?q=gold%20orders%20dataset%20with%20revenue%20by%20region'
just api GET '/search?q=closed%20status%20margin&types=calculated-field,template'
just api GET '/search?q=bar%20chart%20revenue%20region&types=visual&limit=5'
```

It covers dashboards, analyses, datasets, data sources, folders, SMUS
listings, calculated fields (matched on the expression too, so business
rules are findable; one hit per distinct expression listing every asset that
defines it), visuals (title, chart type, sheet, fields in the wells) and the
template library. No model is involved: the index is built from the caches
once per container and reused until an export changes them.

**Token discipline for agents.** Search before you load anything: a hit's
`summary`, `why` and `path` are usually enough to decide, and `types` plus
`limit` keep the response small. Load a definition or a catalog entry only
for the one or two hits you are going to act on. The authoring endpoints
below are built the same way: `datasets` and the plan are short, and the
`preview` outline gives element ids without the full definition.

## 4. Author a dashboard from the API

The authoring endpoints are the same ones the Author page uses, in the same
order. Nothing is written until `apply`.

| Step | Call |
|---|---|
| What datasets does the source read? | `GET /authoring/{dashboard\|analysis}/{id}/datasets` |
| Let the planner propose targets, renames and edits from a sentence | `POST /authoring/{type}/{id}/propose` `{ "ask": "copy this onto the orders gold dataset and make the trend a line chart" }` |
| Check every column against the targets (dry run) | `POST /authoring/{type}/{id}/rebind/plan` `{ "rebinds": [...] }` |
| See the exact definition that would be written, with the changes spelled out and a sheet outline with element ids | `POST /authoring/{type}/{id}/rebind/preview` `{ "rebinds": [...], "ops": [...], "addCalculatedFields": [...] }` |
| Write it: a copy, or in place | `POST /authoring/{type}/{id}/rebind` `{ "mode": "clone", "name": "...", "rebinds": [...], "ops": [...], "addCalculatedFields": [...], "folderId": "..." }` |
| Views, viewers and CloudWatch health for a source | `GET /authoring/{type}/{id}/insights` |

`ops` are validated edit operations against the outline the preview returns:
`move`, `resize`, `retype` (bar, column, line, pie, donut, table, pivot),
`retitle`, `remove`, `duplicate`, `renameSheet`. A `rebind` maps one
dataset identifier in the definition to a target dataset, with an optional
`columnMap` of renames; the plan reports every column as matched, renamed,
suggested or missing, and suggestions are never applied unless you put them
in the `columnMap`.

A typical agent loop: `datasets` → `propose` → read the plan → adjust
`rebinds`/`ops` → `preview` until the outline looks right → `apply` with
`mode: "clone"` → open the result in QuickSight.

## 5. Migrate onto a template's layout standard

Tag a dashboard as the standard (its theme, title band, notes and SIM link,
control bar and tile sizes) and migrate anything onto it in one call, in the
same preview/apply pair:

```bash
just api POST /authoring/dashboard/<id>/rebind/preview '{"rebinds":[...],"template":{"assetType":"dashboard","assetId":"<template-id>"}}'
just api POST /authoring/dashboard/<id>/rebind '{"mode":"clone","name":"...","rebinds":[...],"template":{"assetType":"dashboard","assetId":"<template-id>"}}'
```

The template's text boxes and title band come across at their positions,
its filter and parameter controls where a source dataset has the column
(otherwise `warnings` says which were dropped), its sheet names and its
theme. The source's visuals reflow, in order, into rows of the template's
standard tile size below the furniture, KPIs first at the template's KPI
size when it has a KPI band. Each part can be switched off (`textBoxes`,
`controls`, `sheetNames`, `kpisFirst`, `theme`). Rebinds run before the
template, so a migration to new datasets and a new layout is one request;
`ops` run after it, so the planner's edits still apply.

Cross-dataset filters are checked on every preview and apply: a filter
group scoped to all datasets applies by column name, so a dataset that
lacks the column is skipped silently by QuickSight. The response's
`warnings` names each such dataset, before anything is written.

Type rules ride the same request, applied to every visual at once:

```json
"typeRules": {
  "chartFamily": [{ "from": "Table", "to": "PivotTable" }, { "from": "BarChart", "to": "ColumnChart" }],
  "kpi": true,
  "casts": true
}
```

`chartFamily` retypes every visual of one editable type to another wherever
the field wells translate (the ones that do not fit are named in
`warnings`); `kpi` turns gauges into KPIs and gives every KPI the template's
KPI options; `casts` adds a calculated field with the cast wherever the new
dataset's column type differs from what the definition was built for, and
points the visuals at it.

## 6. Make a dashboard from nothing

Name the datasets and either the visuals, by column names, or an ask and
let the planner propose them:

```bash
just api POST /authoring/new/preview '{"assetType":"dashboard","name":"Sales by region","datasets":[{"identifier":"orders","dataSetId":"<dataset-id>"}],"ask":"revenue and orders by region over the last year, with a monthly trend"}'
just api POST /authoring/new '{"assetType":"dashboard","name":"Sales by region","datasets":[...],"visuals":[...],"template":{"assetType":"dashboard","assetId":"<template-id>"},"permissionsFrom":{"assetType":"dashboard","assetId":"<existing-id>"},"folderId":"<folder-id>"}'
```

A visual is `{ type, title, identifier, category?, granularity?, values:
[{ column, aggregation? }], color? }`; the builder decides the field wells
from the columns' types (dates become date dimensions, numbers measures,
text categories or counts) and leaves out what does not exist, saying so in
`warnings`. The preview returns the definition, its outline and the visuals
that were built or proposed; `template` and `typeRules` work here too. On
create, the asset inherits the audience of `permissionsFrom` (or of the
template), lands in `folderId`, and is recorded and tagged like every other
portal write.

## 7. Repair an asset QuickSight refuses to write

Assets with definition errors cannot be updated as code. Ask what is wrong
and what would fix it:

```bash
just api POST /authoring/dashboard/<id>/repair/plan
```

The plan lists every issue with a proposed fix: a column the dataset no
longer has becomes a rename when one column clearly took the name (a
`columnMap` entry on that identifier's rebind), otherwise `dropColumn`
removes every reference; a parameter used but never declared becomes
`declareParameter` (or `dropParameter`); a dataset that cannot be read asks
you to choose one (send it as `rebinds` and call the plan again to check its
columns); QuickSight's own errors are attached to those findings or listed
as-is. `proposed` is the accepted set in request form:

```bash
just api POST /authoring/dashboard/<id>/rebind/preview '{"repairs":[...],"rebinds":[...]}'
just api POST /authoring/dashboard/<id>/rebind '{"mode":"update","repairs":[...],"rebinds":[...]}'
```

Repairs run before the rebind plan, so the plan checks the repaired
definition; `mode: "clone"` fixes a copy instead of the original.

## 8. Your writes are attributed

Everything an API key writes is recorded by the portal (who, through what,
which asset, which job) and shows on the timeline as "Portal · API key
<label>", filterable with `origins=portal-api`:

```bash
just api GET '/activity/timeline?origins=portal-api&limit=50'
```

Assets the portal writes also carry the tags `portal:authored-by`,
`portal:channel` and `portal:at` (Settings → Provenance to turn tagging
off), so "made by an agent" is a tag filter anywhere tags are.

## 9. Other useful calls

- `POST /smus/export` then `GET /settings/smus/projects`: refresh what the
  portal knows about SageMaker Unified Studio.
- `GET /data-catalog/calculated-fields?projectId=&search=&conflictsOnly=`:
  every calculated field in the account, one row per distinct expression,
  with where it is defined, the datasets and SMUS listings it lives on, usage
  down to visuals, conflicts and templates. `GET
  /data-catalog/calculated-fields/{key}` adds lineage both ways (the columns
  it reads with their SMUS descriptions and glossary terms, the calculated
  fields it builds on, and everything that reads it) and the variants side
  by side. `GET /data-catalog/columns` lists plain columns tied to their SMUS
  column. This is the semantic layer for calculated fields: SMUS owns the
  columns and their meaning, the portal owns the expressions.
- `GET /data-catalog/smus?projectId=...` and
  `GET /data-catalog/smus/{listingId}`: the per-listing view of the same.
- `GET /data-catalog/templates/calculated-fields`: the template library that
  `addCalculatedFields` draws from.
- `POST /export` and `POST /activity/refresh`: the QuickSight export and the
  activity refresh, as jobs.

## Local development

`just dev` runs the API through SAM with the same auth. Create the key
through the local UI, point `QSP_API_URL` at the local API URL, and the same
recipes work against your machine.
