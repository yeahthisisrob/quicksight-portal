# Using the API from a CLI or an agent

Everything the portal's pages do goes through the same REST API, and an
API key gives a script, a CI job or an agent (Claude Code, for example) the
same access a signed-in user has. This guide is the short path from a key to
a published dashboard.

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

## 5. Repair an asset QuickSight refuses to write

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

## 6. Other useful calls

- `POST /smus/export` then `GET /settings/smus/projects`: refresh what the
  portal knows about SageMaker Unified Studio.
- `GET /data-catalog/smus?projectId=...` and
  `GET /data-catalog/smus/{listingId}`: the catalog with calculated fields,
  lineage, usage down to visuals and conflicts.
- `GET /data-catalog/templates/calculated-fields`: the template library that
  `addCalculatedFields` draws from.
- `POST /export` and `POST /activity/refresh`: the QuickSight export and the
  activity refresh, as jobs.

## Local development

`just dev` runs the API through SAM with the same auth. Create the key
through the local UI, point `QSP_API_URL` at the local API URL, and the same
recipes work against your machine.
