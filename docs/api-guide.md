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
datasets, data sources, folders, themes, SMUS listings, calculated fields
(matched on the expression too), visuals and the template library, each hit with
the reason it matched and a one-line summary:

```bash
curl -sS "$QSP_API_URL/api/search?q=gold%20orders%20revenue%20by%20region" -H "Authorization: Bearer $QSP_API_KEY"
curl -sS "$QSP_API_URL/api/search?q=margin&types=calculated-field,template&limit=5" -H "Authorization: Bearer $QSP_API_KEY"
```

Search first: a hit's `summary`, `why` and `path` are usually enough to
decide. Load a full definition only for the one asset you will change.

**The context graph: search, get, follow.** The same knowledge as a graph
of entities and typed relationships, in the shape of AWS Context's agentic
search, so an agent written against these three calls can later be pointed
at Context. Entities: SMUS projects, listings and their columns (with type,
description and glossary terms), glossary terms, data sources, datasets,
calculated fields, analyses, dashboards, visuals, templates and folders.

```bash
curl -sS "$QSP_API_URL/api/context/search?q=orders%20gold&types=listing,dataset" -H "Authorization: Bearer $QSP_API_KEY"
curl -sS "$QSP_API_URL/api/context/entities/listing%3A<listing-id>" -H "Authorization: Bearer $QSP_API_KEY"
curl -sS "$QSP_API_URL/api/context/entities/listing%3A<listing-id>/related?relations=reads-listing&direction=in" -H "Authorization: Bearer $QSP_API_KEY"
```

Relations read subject to object:

| Relation | From | To |
|---|---|---|
| `in-project` | listing | project |
| `has-column` | listing | listing-column |
| `tagged` | listing | glossary-term |
| `reads-listing` | dataset | listing |
| `through-datasource` | dataset | datasource |
| `exposes` | dataset | listing-column |
| `uses-dataset` | analysis, dashboard | dataset |
| `uses-theme` | analysis, dashboard | theme |
| `defined-in` | calculated-field | analysis, dashboard, dataset |
| `reads-column` | calculated-field | listing-column |
| `in-asset` | visual | analysis, dashboard |
| `in-folder` | asset | folder |
| `column-of` | dataset-column | dataset |
| `derived-from` | dataset-column | the parent dataset's column, or the listing-column it carries (followed through renames) |
| `reads-field` | calculated-field | dataset-column, calculated-field |
| `shows` | visual | dataset-column, calculated-field |

`direction=in` follows a relation backwards: the datasets that read a
listing, the dashboards that use a dataset. Field lineage works the same
way: from a dataset column, `relations=reads-field,shows&direction=in&depth=3`
is everything a change to it touches; from a visual,
`relations=shows,reads-field,derived-from&direction=out&depth=3` traces it
to its source columns. `depth` goes up to three hops.
Every hit carries the path that reached it. `/api/search` and
`/api/context/search` both take `projectId` to keep to one SMUS project.
Without SMUS the graph still holds everything QuickSight knows; only the
SMUS entities are missing.

A `calculated-field` entity's attributes carry its `expression`, its
`kind` (`row-level`, `aggregate`, `lac-a`, `lac-w`, `table-calc`), its
`stage` in QuickSight's order of evaluation, its `calcLevel` where it has
one, and `materialisable`: true when SPICE computes it once at ingestion
(row-level and reading no parameter). Only a materialisable field can move
into a dataset or upstream.

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

**Datasets reading the same table** as one, as the table or inside a
custom SQL query, the candidates for consolidating onto one dataset:

```bash
curl -sS "$QSP_API_URL/api/assets/dataset/<dataset-id>/duplicates" -H "Authorization: Bearer $QSP_API_KEY"
```

The datasets list carries the same fact as `sharesTablesWith` on every row,
and `duplicatesFilter=duplicates` on `GET /api/assets/datasets/paginated`
keeps only those.

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

### What is known about a thing: notes

The portal keeps notes on every thing in the account by its graph entity
id, so they survive renames, copies and rebuilds: `analysis:<id>`,
`visual:<assetType>:<assetId>:<visualId>`, `dataset-column:<dataSetId>/<column>`,
`calculated-field:<key>`. Every write the portal makes leaves its change
list as notes on the asset and the visuals it touched, and a copy records
where it came from. A person's note is confirmed as written; what a model
read into a thing is a draft until a person confirms it, and only
confirmed notes reach the planner, which reads them on every plan for the
asset, its visuals, its datasets and their columns.

```bash
# What is known about an analysis (newest first; entity GET returns the same under `notes`)
curl -sS "$QSP_API_URL/api/knowledge/analysis%3A<id>" -H "Authorization: Bearer $QSP_API_KEY"

# Say what a column means, in your words; kind: meaning | rule | identity | preference | description
curl -sS -X POST "$QSP_API_URL/api/knowledge/dataset-column%3A<dataSetId>%2Frevenue" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"kind":"meaning","text":"Net of returns; gross is gross_revenue."}'
# `resolves: "<noteId>"` answers an open question and closes it

# The review queue across the account: a model's unconfirmed readings and open questions
curl -sS "$QSP_API_URL/api/knowledge?status=draft" -H "Authorization: Bearer $QSP_API_KEY"
# Confirm one in your name (optionally with your edit of the text), or remove it
curl -sS -X POST "$QSP_API_URL/api/knowledge/<entityId>/<noteId>/confirm" -H "Authorization: Bearer $QSP_API_KEY"
curl -sS -X DELETE "$QSP_API_URL/api/knowledge/<entityId>/<noteId>" -H "Authorization: Bearer $QSP_API_KEY"

# Learn what an asset is for (a job): one model call drafts readings of it and its visuals
# as draft notes and lists what the definition cannot tell as open questions
curl -sS -X POST "$QSP_API_URL/api/authoring/analysis/<id>/learn" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" --data '{}'
# -> { jobId } ; the job's result is a LearnResult { drafts, questions, known }
```

The assistant does the same in conversation: "learn Sales review and ask me
what you don't understand", then your answers are kept on the right thing;
and when you state a fact about something, it keeps that too. The
"Learn what the busy dashboards and analyses are for" playbook does it
across the account, with the readings and questions on the review rows.

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
| See each calculated field, its expression and what reads it | `GET /api/authoring/{type}/{id}/calculated-fields` |
| Replace a calculated field with a column the dataset now has, rename one, or drop one nothing reads | `ops`: `replaceCalculatedField` (identifier, name, column), `renameCalculatedField` (identifier, name, to), `dropCalculatedField` (identifier, name); no sheetId, they follow every reference |
| Rename a dataset's calculated field without breaking what reads it | `GET /api/authoring/datasets/{id}/calculated-fields?readers=true`, then `POST` the same path with `copyCalculatedField` (name, to); move each reader with a rebind of the same dataset and `columnMap` {old: new}; then `retireCalculatedField` (name, replacedBy), refused while anything still reads the old name. `dryRun: true` checks without writing |
| Repair an asset QuickSight refuses to write | `POST /api/authoring/{type}/{id}/repair/plan`, then `repairs` on the preview |
| Repoint a dataset at another table, query or data source, rename it, or switch it between SPICE and direct query | `PUT /api/assets/dataset/{id}/source` with `tables`, `name` or `importMode`; columns are kept, so what reads it keeps working |
| Move a legacy dataset to the new data prep experience | `POST /api/authoring/datasets/{id}/migrate/preview`, then `.../migrate` with `rebindReaders: true`; a twin, with what reads the original repointed |
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
# Whether it lands on a copy or on the asset itself is yours, not the model's:
# send mode "clone" or "update", or leave it out and Settings decide
# (authoring.editMode; a copy unless changed). A copy with no name takes the
# next version of the original's name (v2, v3...).

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

**From the archive:** what was deleted through the portal is listed by
`GET /api/assets/archived`. A dashboard or analysis comes back through the
same pipeline as a transform: read it with `?source=archive` on
`.../repair/plan`, `.../rebind/plan` and `.../rebind/preview`, then
`POST /api/authoring/{type}/{id}/restore` with the `rebinds`, `ops` and
`repairs` it needs (and `newAssetId` if a live asset holds its id). A deleted
analysis QuickSight still holds in its recovery window comes back through that
recovery under its own id, with the archive's repairs and edits written over it
(`via: recovery` in the result); anything else is created. It
runs as a job (`202` with a `jobId`; the `RestoreResult` is the job's
result) because creating a dashboard and reading it back can outlast a web
request. It comes back fixed, with its archived audience, theme and tags,
or not at all; the result's `warnings` say what could not be carried and
anything QuickSight still reports. A dataset or data source is checked with
`POST /api/assets/{type}/{id}/restore/preview` and restored with
`.../restore`.

**Refreshes.** `POST /api/ingestions/{datasetId}` starts a SPICE refresh now
(`type` FULL_REFRESH or INCREMENTAL_REFRESH); the ingestion shows in
`GET /api/ingestions` at once. A dataset's schedules are live at
`GET /api/assets/dataset/{id}/refresh-schedules`; `POST` there adds one
(`interval`, `refreshType`, `timeOfTheDay` and `timezone` for daily and
longer, `dayOfWeek` for weekly, `dayOfMonth` for monthly), `PUT
.../{scheduleId}` changes one and `DELETE .../{scheduleId}` removes it. Every
write refreshes the dataset's export, which carries the schedules.

**Folders.** `POST /api/folders` makes a shared folder (a `name`, and
`parentFolderId` to nest it); `DELETE /api/folders/{id}` deletes an empty one,
or with `?force=true` takes its assets out first (they are kept; subfolders are
never removed on the way). `GET /api/folders/{id}/permissions` lists who can
see or work in it with the role their actions amount to; `POST
/api/folders/{id}/members` with `memberType` USER or GROUP, the `memberId` and
a `role` (VIEWER, AUTHOR, ADMIN) shares it, and `DELETE
/api/folders/{id}/members/{memberId}?type=USER` takes someone off it. Assets go
in through the same members route, or many at once with `POST
/api/folders/{id}/assets/bulk`.

**History.** Every dashboard, analysis and dataset keeps its versions: one is
kept whenever an export, a refresh or a portal write finds the definition
changed (volatile fields such as timestamps and status do not count), with who
changed it (a person when the portal wrote it, "Outside the portal" when an
export found the change) and what changed in words. `GET /api/history/{type}/{id}`
lists them newest first; `GET /api/history/{type}/{id}/{versionId}` reads one
with its definition; `GET /api/history/{type}/{id}/{versionId}/diff` compares it
with the version before (`?against=<versionId>` with another, `?against=live`
with what is live now), answering with the change lines and every differing
path; `GET /api/history` lists what changed lately across the account.
`POST /api/authoring/{type}/{id}/versions/{versionId}/restore` puts a version
back: it writes that definition over the live asset as a new version (a job;
the `RollbackResult` is its result), so nothing is lost. Settings › History sets
how many versions each asset keeps.

**A theme.** Custom themes are listed with their colors, the theme they
start from and how many dashboards and analyses wear each one:
`GET /api/assets/themes/paginated`. Put one on a dashboard or analysis
with `POST /api/authoring/{type}/{id}/rebind` and
`{"mode":"update","rebinds":[],"theme":"<theme-id>"}` (a theme's id, its
ARN, or `CLASSIC`, `MIDNIGHT`, `SEASIDE`, `RAINIER`); `theme` goes with any
other transform or clone too. New ones:

```bash
# From a draft
curl -sS -X POST "$QSP_API_URL/api/authoring/themes" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"name":"Acme","baseThemeId":"CLASSIC","dataColors":["#0B6E4F","#F2A541","#1F77B4"],"uiColors":{"Accent":"#0B6E4F"}}'

# From a picture of a brand, a logo or a layout (a job; the result is a draft, nothing is created)
curl -sS -X POST "$QSP_API_URL/api/authoring/themes/propose" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data "{\"image\":\"data:image/png;base64,$(base64 < brand.png)\",\"note\":\"dark mode\"}"
# -> { jobId } ; the result is { draft, rationale, model }: send the draft to /api/authoring/themes
```

The theme new assets wear, when they are built from nothing, is the
`authoring.defaultTheme` setting.

**Audience and housekeeping**, when the write itself is not enough:

- `POST /api/assets/{type}/{id}/grant-permissions` and
  `.../revoke-permissions` with `{ "grants": [{ "principal": "<user or group ARN>", "actions": [...] }] }`
  (a job).
- `POST /api/tags/{type}/{id}`, `PUT`, `DELETE`; `POST /api/tags/bulk` for many,
  of any types at once (`"assets": [{ "assetType", "assetId" }]`, a job).
- Tags on something new go in the create call itself (`tags` on
  `/api/authoring/new`, `/api/authoring/definition`, and a clone), so it
  never exists untagged; the organisation's default tags from Settings are
  added, and `portal:` keys are the portal's own.
- `POST /api/folders/{folderId}/members` and `.../assets/bulk`.
- `POST /api/assets/{type}/{id}/rename`, `PUT /api/assets/dataset/{id}/source`.

**A new dataset.** A query, a table, or a published SMUS listing, through
one of the account's data sources. Preview first: the preview settles the
columns, says which datasets already read the same table, and names the
SMUS listing the new one will be linked to. Then create with the same body.

```bash
# Which data source: every one in the account, most used first, with its engine
curl -sS "$QSP_API_URL/api/authoring/datasources" -H "Authorization: Bearer $QSP_API_KEY"

# Preview a custom SQL dataset (nothing is written)
curl -sS -X POST "$QSP_API_URL/api/authoring/datasets/preview" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"name":"Signups by month","source":{"kind":"sql","dataSourceId":"<data-source-id>","sql":"select date_trunc('"'"'month'"'"', signed_up) as month, count(*) as signups from published_prod.dim_customer group by 1"},"folderId":"<folder-id>"}'

# Create it
curl -sS -X POST "$QSP_API_URL/api/authoring/datasets" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{ ...the same body... }'
```

`source.kind` is `sql` (`sql`, `dataSourceId`), `table` (`schema`, `table`,
`dataSourceId`, optional `catalog`) or `listing` (`listingId`; the data
source defaults to the Athena one the SMUS-linked datasets already read
through). QuickSight needs every column declared, so the preview resolves
them: from the listing's metadata forms (for a listing, and for a query
that only selects columns of one published table), from `columns` when
you declare them (`[{ "name", "type" }]`, types STRING, INTEGER, DECIMAL,
DATETIME, BOOLEAN, BIT, JSON), or by asking the engine. For an Athena data source the
portal runs the query through the source's workgroup with no rows read and
takes the result's columns, so a query Athena refuses comes back as a 400
with the engine's reason. A governed (Lake Formation) table the portal's
role was never granted on reads as "does not exist"; the error says which
databases to have an admin grant. Any other engine needs `columns`. The response
carries `columns`, `columnsFrom` (`listing`, `declared` or `query`),
`similar` (datasets that already read the same table, as the table or in
their SQL; reuse one unless a new dataset is wanted) and `listing`.

A `table` or a `listing` is read as custom SQL, `SELECT * FROM` the table,
unless `source.asTable` is true. Every dataset is written in the new data
prep experience (`DataPrepConfiguration` and `SemanticModelConfiguration`,
never the deprecated `LogicalTableMap`). A dataset built in the legacy
experience cannot be opened in the new data prep or be the parent of a
new dataset, and QuickSight has no in-place upgrade: `POST
/api/authoring/datasets/{id}/migrate/preview` says what a twin in the new
experience would carry (tables, joins, calculated fields, renames, casts,
filters, descriptions and roles, row-level security, audience, tags,
folders, schedules), what it leaves behind and why it cannot be built;
`POST /api/authoring/datasets/{id}/migrate` with `{"rebindReaders": true}`
creates it and repoints every dashboard and analysis reading the original.
The original stays until deleted. `GET /api/assets/dataset/{id}/source`
says which `experience` a dataset is in, every dataset row of
`GET /api/assets/datasets/paginated` carries it, and `experienceFilter=legacy`
lists the ones still to move.

`importMode` is SPICE unless the request says `DIRECT_QUERY` or an admin
changed the default in Settings; the preview says which. A SPICE dataset
starts its first import on creation, and the create response names it in
`ingestionId`: visuals show data once it completes. An existing dataset
switches either way with `PUT /api/assets/dataset/{id}/source` and
`{"importMode": "SPICE"}`, nothing else changed.

Nothing is created in SMUS: a dataset is linked to a listing by what it
reads, the Glue table behind the listing named as the table or in the SQL,
by the same matching that links every other dataset. The person who creates
it owns it; `permissionsFrom` copies an audience (a dataset's as it is, an
analysis's or dashboard's translated to dataset actions); it is filed in
`folderId` and the default folders from Settings, and tagged with the
organisation's defaults, `tags`, and provenance.

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
as a wireframe, an asset, a calculated field's lineage, a `plan` and its
`fields`), and returns `actions` (writes it prepared, each tied to the
preview it publishes and the plan it follows). It never writes; you run an
action with your own key when it looks right. Send the whole conversation,
text only, each time.

**The run protocol follows AG-UI 1.0** ([docs.ag-ui.com](https://docs.ag-ui.com)). Only
its data model is used; the transport is still a job you poll.
- **Every result has an `outcome`.** It is `{ "type": "success" }` when the answer is done. It is `{ "type": "interrupt", "interrupts": [...] }` when the assistant asked a question.
- **A question is an interrupt with reason `input_required`.** Its `metadata.options` hold the choices, each tied to a context-graph entity where it names one. `responseSchema` is the JSON Schema of the answer.
- **To answer,** send the next message with `resume: [{ "interruptId": "...", "status": "resolved", "payload": { "selected": ["dataset:abc"] } }]`.
- **Send the page's working state as `state`.** `drafts` holds the actions the assistant prepared that you did not run. `ran` holds the actions you ran, with their results. The assistant revises drafts instead of looking for assets that don't exist yet, and never repeats what already ran.
- **Keep one `threadId` per conversation.**

Before it prepares anything that creates or changes a dataset, an analysis
or a dashboard, the assistant draws a `plan`: the SMUS listings the data
comes from (when SMUS is used), the datasets (existing, or new and through
which data source), and the analysis or dashboard (new, edited or as it
is). It reuses a dataset already linked to a listing, or already reading the
same table, unless you ask for a new one; a dataset on its own is one
prepared write (`POST /api/authoring/datasets`, previewed first). When no
data source is named and more than one could serve, it asks which, as
options. The `fields` artifact places each calculated field the plan adds:

| Verdict | Meaning |
|---|---|
| `use-column` | Row-level, and the dataset already has it as a column |
| `push-down` | Row-level; your guidance says the source should materialise it |
| `dataset` | Row-level; your guidance says it belongs in the QuickSight dataset |
| `row-level` | Row-level; your guidance states no preference |
| `analysis` | Aggregates, table or level-aware calculations, or parameters |

**Filters, controls and interactions.** Building from nothing
(`POST /api/authoring/new`), send `filters` by column name, each with the
control you want: text columns take `dropdown` (the default), `singleSelect`
or `list`; dates take `dateRange` (the default) or `relativeDate` with
`lastDays`; numbers take `slider` with `min` and `max`. A control goes in the
sheet's control bar (`placement: "controlBar"`, the collapsible strip at the
top, the default) or on the canvas above the visuals (`"canvas"`). A filter
narrows every visual unless `appliesTo` names some, by their `key` or title.
A visual's `actions` give it interactions: `{ "kind": "filter" }` filters the
other visuals (or its `targets`) when a data point is clicked - an action
filter - and `{ "kind": "navigate", "sheet": "Detail" }` opens another sheet;
one action runs on click, the rest go in the visual's menu
(`"trigger": "menu"`).

To change an existing analysis, send ops to `.../rebind` with
`mode: "update"`: `addVisual` (a VisualSpec), `addFilter` (the dataset
identifier, the column, and the same control, placement and `appliesTo`) and
`addAction` (a visual by element id or title, and the action), alongside
`move`, `resize`, `retype`, `retitle` and `remove`. The layout is blocks on
a 36-column grid: `move`, `duplicate` and `addVisual` take `place`
(`bottom`, or `beside` / `below` an `anchor` element) and `resize` takes
`size` (`small`, `medium`, `large`, `wide`, `full`); the sheet is then laid
out again with rows packed and nothing overlapping. `col`/`row` and
`colSpan`/`rowSpan` still work when you mean exact grid units.

Anything that cannot be built as asked - a column the dataset does not
have, a control that does not fit its column, a slider without its range -
refuses the whole preview or create with the reason. Nothing you ask for is
left out quietly. Every request body is also checked against this contract
before it reaches its handler: a body that does not fit is a `400` naming
each field.

The organisation's standard filter bars live at
`/api/data-catalog/templates/filter-bars`. The default bar is applied to
every new analysis unless `filterBarTemplateId` names another or `none`; its
controls come first, and yours follow.
Saved visuals live at `/api/data-catalog/templates/visuals`, stored by
column name. Add them to a new analysis with `visualTemplates: [{ "templateId":
"...", "identifier": "orders" }]`. They work on any dataset that has the
columns.

**Authoring guidance.** Settings, under Authoring guidance, holds how your
organisation builds: a calculated-field strategy (materialise in the
source, in the dataset, or no preference) and free text about your
architecture, datasets, explorations and visuals. The assistant and the
planner follow it. Each prompt carries only the parts that apply, and
nothing when it is empty. Its vocabulary setting adds your organisation's
words for what to build ("slicer = a dropdown filter in the control bar"),
read ahead of the built-in vocabulary that maps requests such as "a table
with a filter" or "add an action filter" onto the constructs above.

**Plans are the write.** The assistant draws every authoring change as a
plan. The chat model (cheap by default) finds the data and writes a brief of
exactly what was asked; the authoring model you pick for builds drafts the
build from it through `/api/authoring/new/propose` or
`/api/authoring/{assetType}/{assetId}/propose`. The build is the exact
request - `create` (a new asset's body) or `edit` (`assetType`, `assetId`
and the rebind body) - checked against this contract and previewed before
the plan is shown; a draft that fails goes back to the authoring model with
the reason. The plan names the model that drafted it, and the Run button
under it sends the build unchanged. The page keeps the plans in its working
state (`state.plans`), so "go" in a later message carries out the plan
drawn earlier. A proposal's `problems` lists edits it proposed that do not
apply, each with the reason.

## 7. Fixes across the account: playbooks

A playbook finds the assets it could touch, checks each one against what
QuickSight has now, and changes only what you choose. Every change goes
through the same endpoints as above, as the key that started it.

```bash
# What there is: each playbook's parameters and gates
curl -sS "$QSP_API_URL/api/playbooks" -H "Authorization: Bearer $QSP_API_KEY"

# Preview (a job): nothing is written
curl -sS -X POST "$QSP_API_URL/api/playbooks/consolidate-athena/preview" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"params":{"target":"<athena-data-source-id>"},"gates":{"editedWithinDays":7}}'
# -> { jobId } ; wait on /api/jobs/{jobId}

# Every asset it found: verdict change, review or skip, and why
curl -sS "$QSP_API_URL/api/playbooks/runs/<preview-job-id>/items?verdict=change" \
  -H "Authorization: Bearer $QSP_API_KEY"

# Run the preview's changes (or only `keys`), a few at a time
curl -sS -X POST "$QSP_API_URL/api/playbooks/consolidate-athena/run" \
  -H "Authorization: Bearer $QSP_API_KEY" -H "Content-Type: application/json" \
  --data '{"previewJobId":"<preview-job-id>","limits":{"concurrency":4,"failureThreshold":0.2}}'
```

- **Gates** hold assets back: recent edits, only tagged assets, a canary
  of the first few. Tag an asset `portal:playbook-skip` and no playbook
  touches it. Held-back assets are listed as skipped, with the reason.
- **A run checks each asset again** just before it changes it: one fixed
  by hand since the preview is skipped, one that now needs a decision is
  left for review. It stops starting new assets once more than
  `failureThreshold` of those tried have failed.
- **Retry** the failures of a run with `"retryOf":"<run-job-id>"`.
- **Compose your own.** `POST /api/playbooks/custom` saves a spec:
  `inputs`, what to `select` (asset types and conditions: views, engine it
  reads, SMUS-governed, shared with, tagged, name, errors) and the `steps`
  (match a replacement dataset, optionally letting a model map names that
  differ, then rebind; tag; repair; add to a folder; replace calculated
  fields the governed dataset now holds as columns, judged by a model; drop
  calculated fields nothing reads; rename them to a prefix and snake_case,
  in dashboards and analyses or, migrated reader by reader, in datasets;
  each dry-run first; give a theme with `applyTheme`, choosing by
  `usesTheme`, with `"value": false` for the ones not wearing it). A spec can select users instead of assets, with
  `role`, `inactiveForDays` and `noAccess` (in no group and reaching no
  asset; `ignoreGroups` and `ignoreFolders` name the ones that do not
  count) and the `deleteUser` step, which deletes idle readers only while
  `GET /api/activity/coverage` shows the activity covers the window and
  was refreshed in the last two days. Any value can be
  `{{inputKey}}`. `GET /api/playbooks/custom/{id}` returns a shipped
  example's spec too, to copy. A saved one previews and runs like the rest;
  pass `model` on the preview when it asks a model.
- **Reports.** `GET /api/playbooks/runs/{jobId}/report` has every row and
  how it went; `POST` the same path keeps it beyond the jobs' 30 days
  (`GET /api/playbooks/reports` lists what was kept).
- **Deleting a user** (`DELETE /api/users/{userName}`, readers only)
  archives their groups and direct permissions first; once they are back
  in QuickSight, `POST /api/users/{userName}/restore` gives them back
  (`GET /api/users/{userName}/archive` shows what was kept).
- **Deleting one asset** outside a playbook: `DELETE
  /api/assets/{type}/{id}?reason=...` archives it first; restore it later.

## 8. A typical agent loop

1. `GET /api/search?q=...` or `GET /api/context/search?q=...` to find the
   asset and the dataset, and `.../related` to follow the lineage.
2. `GET /api/assets/dashboard/{id}/cached` for the definition, and
   `GET /api/authoring/datasets/{dataset-id}/columns` for what the target has.
3. Build the change: edit the definition, or compose `rebinds`, `ops`,
   `template`, or ask the planner and wait for the job.
4. Preview (`.../definition/preview` or `.../rebind/preview`) until
   `canApply` and the outline look right.
5. Apply with `mode: "clone"`, then open the result in QuickSight.
6. `GET /api/activity/timeline?origins=portal-api` shows what the key did.

## 9. Where this is heading

AWS Context, announced in June 2026 and not yet available, is an
identity-aware knowledge graph over an organisation's data that agents
query at runtime. Once it can read QuickSight, an agent will get search,
lineage and metadata from there, and this portal will point it that way
just as it points at SMUS today. The `/api/context` calls above are shaped
the same way now, so moving over is a change of URL. What stays here is what
a graph does not do: the parsed definitions, the checks, and the write paths
above.
