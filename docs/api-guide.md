# QuickSight Assets Portal API

Everything the portal's pages do is a call you can make with an API key.
This guide is written for a person or an agent that has a key and the
portal's URL and nothing else. It says which calls to make, in which
order, to read what the portal knows about QuickSight, build a change with
whatever you like, and publish it back safely.

The contract itself is served next to this guide: `GET /api/api-docs/openapi`
is the OpenAPI document every endpoint is validated against, with `servers`
set to the portal that served it. Every path in it is callable with a key.
The Author page's **API** tab shows the same contract, searchable, with a
curl for each operation.

## 1. Key and URL

A key is created in the portal under Settings → API keys (or on the Author
page's API tab). The secret is shown once. It is as powerful as a signed-in
user, except that it cannot manage keys. Put it and the portal's URL in the
environment of whatever will call the API:

```bash
export QSP_API_URL="https://d1234abcd.cloudfront.net"
export QSP_API_KEY="qsp_..."
```

Every request carries the key as a bearer token:

```bash
curl -sS "$QSP_API_URL/api/api-docs/guide"   -H "Authorization: Bearer $QSP_API_KEY"
curl -sS "$QSP_API_URL/api/api-docs/openapi" -H "Authorization: Bearer $QSP_API_KEY"
```

Responses are `{ "success": true, "data": ... }` or `{ "success": false,
"error": "..." }`. A 401 means the key is unknown or revoked.

## 2. Calls that run in the background

Anything that can take longer than a web request runs as a job: exports,
bulk operations, and every call that asks a model something. Those return
`202` with a `jobId`. Poll the job until it settles, then read its result:

```bash
curl -sS "$QSP_API_URL/api/jobs/$JOB_ID"        -H "Authorization: Bearer $QSP_API_KEY"   # status: queued | processing | completed | failed
curl -sS "$QSP_API_URL/api/jobs/$JOB_ID/result" -H "Authorization: Bearer $QSP_API_KEY"   # what it produced, once completed
curl -sS "$QSP_API_URL/api/jobs?limit=20"       -H "Authorization: Bearer $QSP_API_KEY"   # recent jobs
```

A failed job carries the reason in `message`. The result's shape depends
on the job; the operation that queued it says what to expect.

## 3. Read what the portal knows

The portal keeps a full export of the account: every definition,
permission set, tag, lineage edge, activity event and ingestion, indexed
and cached. One call answers what would take many rate-limited calls
against QuickSight itself. Read before you write.

**Search in plain words.** One ranked search over dashboards, analyses,
datasets, data sources, folders, SMUS listings, calculated fields (matched
on the expression too), visuals and the template library, each hit with
the reason it matched and a one-line summary:

```bash
curl -sS "$QSP_API_URL/api/search?q=gold%20orders%20revenue%20by%20region" -H "Authorization: Bearer $QSP_API_KEY"
curl -sS "$QSP_API_URL/api/search?q=margin&types=calculated-field,template&limit=5" -H "Authorization: Bearer $QSP_API_KEY"
```

Search first: a hit's `summary`, `why` and `path` are usually enough to
decide. Load a full definition only for the one asset you will change.

**Lists, one type at a time**, paginated, filtered, sorted:

```bash
curl -sS "$QSP_API_URL/api/assets/dashboards/paginated?page=1&pageSize=20&search=sales" -H "Authorization: Bearer $QSP_API_KEY"
```

`dashboards`, `analyses`, `datasets`, `datasources`, `folders`, `users`,
`groups`. Dashboards and analyses carry view counts for ranking.

**One asset's export**, exactly as QuickSight described it, from the
cache:

```bash
curl -sS "$QSP_API_URL/api/assets/dashboard/<id>/cached" -H "Authorization: Bearer $QSP_API_KEY"
```

This is the definition JSON to edit if you are building the change
yourself (section 4), plus permissions, tags and lineage.

**A dataset's columns**, live, with types:

```bash
curl -sS "$QSP_API_URL/api/authoring/datasets/<dataset-id>/columns" -H "Authorization: Bearer $QSP_API_KEY"
```

**What a definition reads from each dataset**, for an existing asset:

```bash
curl -sS "$QSP_API_URL/api/authoring/dashboard/<id>/datasets" -H "Authorization: Bearer $QSP_API_KEY"
```

**The semantic layer.** `GET /api/data-catalog/calculated-fields` lists
every calculated field in the account, one row per distinct expression,
with where it is defined, its datasets and SMUS listings, usage down to
visuals, conflicts and templates. `GET /api/data-catalog/calculated-fields/{key}`
adds lineage both ways. `GET /api/data-catalog/columns` ties plain columns
to their SMUS column. `GET /api/data-catalog/smus` is the same, listing
first.

**How an asset is used and how healthy it is:** `GET
/api/authoring/{dashboard|analysis}/{id}/insights` (views, viewers,
CloudWatch health), `GET /api/activity/timeline` (who changed what, with
`origins=portal-api` for what keys did), `GET /api/ingestions` (SPICE
refreshes).

## 4. Build the change

Two ways, and they mix.

**Build it yourself.** Take the definition from the cached export, edit
the JSON however you like (a model, a script, by hand), and hand it back.
The portal checks it the way its own Author page checks everything: every
declared dataset is read, every referenced column resolved against it, and
everything QuickSight would refuse is listed with a fix where one is clear.
Nothing is written by a preview:

```bash
curl -sS -X POST "$QSP_API_URL/api/authoring/dashboard/<id>/definition/preview" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"definition": { ...the full definition... }}'
```

The response says per dataset what was readable and which columns are
missing, lists `issues` (each with a `fix`), draws the sheets as an
`outline`, and sets `canApply`. Fix what it names and preview again until
it is clean. For an asset that does not exist yet, `POST
/api/authoring/definition/preview` takes the same body.

**Or use the transforms.** The same operations the Author page runs, each
a preview then an apply. All of them keep the source's permissions and
theme and never write a definition QuickSight would refuse:

| Want | Call |
|---|---|
| Point an asset at different datasets, with column renames checked | `POST /api/authoring/{type}/{id}/rebind/plan`, then `.../rebind/preview` |
| Edit visuals as operations: move, resize, retype, retitle, remove, duplicate, rename a sheet | `ops` on `.../rebind/preview` (the preview's `outline` gives the element ids) |
| Migrate onto a template dashboard's layout standard | `template` on `.../rebind/preview` |
| Convert chart families, standardise KPIs, add casts for changed column types | `typeRules` on `.../rebind/preview` |
| Add calculated fields from the template library | `addCalculatedFields` on `.../rebind/preview` |
| Repair an asset QuickSight refuses to write | `POST /api/authoring/{type}/{id}/repair/plan`, then `repairs` on the preview |
| A dashboard from nothing, by naming columns | `POST /api/authoring/new/preview` with `visuals` |

**Or ask the planner.** A model turns a sentence into a validated
proposal. These run as jobs (section 2), because a long think outlives a
web request:

```bash
# "copy this onto the orders gold dataset and make the trend a line chart"
curl -sS -X POST "$QSP_API_URL/api/authoring/dashboard/<id>/propose" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"ask": "copy this onto the orders gold dataset and make the trend a line chart"}'
# -> { jobId } ; the job's result is a Proposal: rebinds, ops, a dry-run plan, and why

# From nothing: the planner proposes visuals from the datasets' columns
curl -sS -X POST "$QSP_API_URL/api/authoring/new/propose" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"assetType":"dashboard","name":"Sales by region","datasets":[{"identifier":"orders","dataSetId":"<dataset-id>"}],"ask":"revenue and orders by region, with a monthly trend"}'
# -> { jobId } ; the job's result is a NewAssetPreview whose visuals go straight into the preview and create calls
```

A proposal is never applied by itself. Read it, adjust, then publish.

## 5. Publish it back

Every write path records who did it (the key's label, on the timeline and
as tags on the asset), keeps the audience, and publishes the dashboard
version so viewers see it at once.

**A definition you built:**

```bash
# In place
curl -sS -X POST "$QSP_API_URL/api/authoring/dashboard/<id>/definition" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"mode":"update","definition":{ ... }}'

# As a copy, in a folder, with another asset's audience
curl -sS -X POST "$QSP_API_URL/api/authoring/dashboard/<id>/definition" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"mode":"clone","name":"Sales (gold)","folderId":"<folder-id>","permissionsFrom":{"assetType":"dashboard","assetId":"<exec-summary-id>"},"definition":{ ... }}'

# A new asset from a definition alone
curl -sS -X POST "$QSP_API_URL/api/authoring/definition" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"assetType":"analysis","name":"Margin analysis","permissionsFrom":{"assetType":"analysis","assetId":"<id>"},"definition":{ ... }}'
```

Apply refuses, with the same issues the preview lists, rather than leave a
broken asset behind.

**A transform:** `POST /api/authoring/{type}/{id}/rebind` with `mode:
"update"` or `"clone"` and the same `rebinds`, `ops`, `template`,
`typeRules`, `addCalculatedFields`, `repairs` the preview took. **From
nothing:** `POST /api/authoring/new` with the preview's body plus
`permissionsFrom` and `folderId`.

**Audience and housekeeping**, when the write itself is not enough:

- `POST /api/assets/{type}/{id}/grant-permissions` and
  `.../revoke-permissions` with `{ "grants": [{ "principal": "<user or group ARN>", "actions": [...] }] }`
  (a job).
- `POST /api/tags/{type}/{id}`, `PUT`, `DELETE`; `POST /api/tags/bulk` for many.
- `POST /api/folders/{folderId}/members` and `.../assets/bulk`.
- `POST /api/assets/{type}/{id}/rename`, `PUT /api/assets/dataset/{id}/source`.
- `POST /api/smus/assets/{listingId}/dataset`: a QuickSight dataset over a
  published SMUS asset.

**After a burst of writes made directly against QuickSight** (that is
expected: when something you need is not here, go to the QuickSight API),
run `POST /api/export` so the cache, the catalog and search see what you
did. If you write straight to QuickSight, tag the asset the way the
portal does, `portal:authored-by` = `api-key:<label>`, `portal:channel` =
`api`, `portal:at` = the ISO time, so it is attributed like everything
else.

## 6. Pick the model, or ask the assistant

**The model.** `GET /api/assistant/models` lists the five that can do the
thinking, with list prices and a rough cost for a typical call: Claude
Haiku 4.5, Claude Sonnet 4.6 (the default for authoring), Claude Sonnet 5,
Claude Opus 5, and OpenAI when the stack has an endpoint and key for it.
Send a model's `key` as `model` on `.../propose` and
`/api/authoring/new/propose`; without it the stack's configured planner
answers.

**The assistant.** `POST /api/assistant/chat` with `{ "messages": [{ "role":
"user", "text": "..." }], "model": "haiku-4-5" }` is a job whose result is
an answer from a model that used this API as you: it runs reads and
previews itself, returns `artifacts` to draw (a preview to re-run and draw
as a wireframe, an asset, a calculated field's lineage), and returns
`actions` (writes it prepared, each tied to the preview it publishes). It
never writes; you run an action with your own key when it looks right.
Send the whole conversation, text only, each time.

## 7. A typical agent loop

1. `GET /api/search?q=...` to find the asset and the dataset.
2. `GET /api/assets/dashboard/{id}/cached` for the definition, and
   `GET /api/authoring/datasets/{dataset-id}/columns` for what the target has.
3. Build the change: edit the definition, or compose `rebinds`, `ops`,
   `template`, or ask the planner and wait for the job.
4. Preview (`.../definition/preview` or `.../rebind/preview`) until
   `canApply` and the outline look right.
5. Apply with `mode: "clone"`, then open the result in QuickSight.
6. `GET /api/activity/timeline?origins=portal-api` shows what the key did.

## 8. Where this is heading

AWS Context, announced in June 2026 and not yet available, is an
identity-aware knowledge graph over an organisation's data that agents
query at runtime. Once it can read QuickSight, an agent will get search,
lineage and metadata from there, and this portal will point it that way
just as it points at SMUS today. What stays here is what a graph does not
do: the parsed definitions, the checks, and the write paths above.

---

*From this repository:* `just api GET /search?q=...` wraps curl with the
header and the base URL, and `shared/schemas/api.openapi.yaml` is the
source of the served contract.
