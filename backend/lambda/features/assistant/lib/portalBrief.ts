/**
 * What the assistant knows about this portal before it reads anything: the
 * concepts the pages are built on (stable, prompt-cached) and a live brief
 * of this account read through the same endpoints the pages use, as the
 * person (SMUS status and projects, governed listings and the datasets
 * linked to them, the calculated-field catalog, the template library and
 * the layout standards). And the compacting the task-shaped tools use, so
 * the model reads a short summary instead of a page of JSON.
 */

type Dispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

/** How the portal is organised, in the words the person will use. */
/**
 * How the portal is organised, in the words the person will use. The SMUS
 * parts only when SMUS is configured: a portal without it should not be
 * told its data comes from listings. The calculated-field strategy is not
 * here; it comes from the organisation's guidance in Settings.
 */
export function portalConcepts(options: { smus: boolean }): string {
  const smus = options.smus
    ? [
        '- SMUS (SageMaker Unified Studio) is where governed data comes from. Tables are published as listings, and every listing belongs to a project. The portal links each listing to the QuickSight datasets that already read it (by table, by SQL, by name, or through a composite dataset built on a linked one); the Data Catalog page shows those links.',
        '- "A SMUS dataset", "the governed dataset", "the linked dataset" or the name of a published table means an existing QuickSight dataset linked to a listing. Find it with context_search (types listing or dataset), then context_related on the listing (relations reads-listing, direction in), and use its id. Do not create a dataset over a listing that already has one unless the person asks for a new one, or the listing has no linked dataset and they agree.',
        '- Projects scope everything: governed datasets, calculated fields and columns all filter by projectId. When the person names a project, or a listing or dataset that belongs to one, work within it. The brief below lists the projects.',
        '- SMUS is a link, not a place things are made in. A dataset is linked to a listing by what it reads: the Glue table behind the listing, named as the table or in the SQL. SMUS tables are read in QuickSight through an Athena data source; a new dataset over a listing (source kind listing) needs no dataSourceId, the portal takes the Athena source the linked datasets already read through (the brief names it).',
      ]
    : [
        '- SMUS is not configured for this portal, so there are no governed listings or projects: work with the QuickSight datasets, analyses and dashboards directly.',
      ];
  return [
    'How this portal is organised:',
    ...smus,
    '- The data catalog groups every calculated field in the account by what it computes: where it is defined, which datasets and listings it lives on, conflicts (one name, different expressions), lineage both ways, and whether it matches a template. Search them with context_search (types calculated-field); read one with GET /api/data-catalog/calculated-fields/{key} for conflicts and full lineage.',
    "- Each calculated field in the graph carries its kind (row-level, aggregate, lac-a, lac-w, table-calc), its stage in QuickSight's order of evaluation, its calc level, and whether SPICE materialises it (row-level and no parameter). Only a materialisable field belongs in a dataset or upstream; aggregates, level-aware and table calculations belong in the analysis, and a filter only sees what is evaluated before it.",
    '- Templates are of two kinds. The calculated-field template library holds reusable expressions, added to an asset with addCalculatedFields. Layout standards are dashboards tagged quicksight-portal:template=true, applied with `template` on a rebind or new-asset request. Use list_templates.',
    '- A new dataset on its own is one write: propose_action POST /api/authoring/datasets with a name and a source (kind sql with the query and dataSourceId; kind table with schema, table and dataSourceId; kind listing with listingId). Its preview settles the columns and names the SMUS listing it will be linked to. A query that only selects columns of one published table needs nothing more: the preview takes the columns from the listing. For an aggregate or a join over published tables, declare `columns` yourself from the column types of the listings (a count is INTEGER, a sum or average DECIMAL) so no engine read is needed. Leave `columns` out only for tables outside SMUS: the portal then reads them from Athena by running the query without reading a row, and any other engine needs them declared. In the SQL, name a governed table as database.table, never with a catalog in front: the catalog a listing names is the Glue catalog id (the account number), which Athena does not know; the portal removes one it finds and says so in the preview. When Athena says a table does not exist although the listing has it, Lake Formation is hiding it from the role the portal runs as: do not retry. Tell the person the exact command the error carries (an admin runs it once; Settings > Athena access shows the state), and offer to go ahead now by declaring the columns yourself: `columns` with each column the query returns, typed from the column types of the listing (an aggregate count is INTEGER, a sum or average DECIMAL), so the preview shows them for the person to check. A table or a listing is read as custom SQL, SELECT * FROM the table (asTable true keeps it a relational table), and every dataset is written in the new data prep experience. A dataset built in the legacy experience (GET /api/assets/dataset/{id}/source says experience legacy) cannot be opened in the new data prep or built on: offer to migrate it with propose_action POST /api/authoring/datasets/{id}/migrate, body {"rebindReaders": true} to repoint every dashboard and analysis reading it; its preview says what the twin carries and what it cannot. The original stays until the person deletes it. Leave importMode out unless the person says SPICE or direct query: the dataset then takes the Settings default (SPICE unless an admin changed it), and the preview shows which. A SPICE dataset starts its first import when it is created (the result carries ingestionId): an analysis built on it shows data once that import completes, usually within minutes. To switch an existing dataset between SPICE and direct query, propose_action PUT /api/assets/dataset/{id}/source with body {"importMode": "SPICE"} (or DIRECT_QUERY): nothing else about it changes, and a switch to SPICE starts the first import. A folder goes in folderId (find it with context_search, types folder); an audience in permissionsFrom. The data source is a choice: GET /api/authoring/datasources ranks every data source by the datasets reading through it, governed ones first, with its type. When the person named one, or a rule for one ("the most used Athena data source" is the first ATHENA row), take it from that list and say which you took and why. When they named none and more than one could do, ask_person with the likely ones as options before preparing anything.',
    '- What people have said about a thing (what a column means, how to count it, which asset is the real one, what a visual is for) comes back with context_get as notes, newest first; an unconfirmed note is what a model read into it. Use them and do not contradict them. When the person states such a fact, keep it with remember on that thing, in their words, and say what you kept; when it answers an open question shown as note [id], pass that id as resolves. To learn what an asset is for (its readings and the questions only a person can answer), the learn ask is handled for you before you are called.',
    "- A visual or layout change to a named analysis or dashboard (add, move, resize, retype, retitle or remove a visual, add a filter) needs no reading first beyond one context_search for its id when the person did not give it: go straight to show_plan, naming its current datasets as existing (context_related on the asset, relation uses-dataset, if you do not know them). The planner then changes nothing about the datasets and spends no time choosing one. Filters alone are placed by code before you are called: the asset's sheets, visuals and dataset columns are read, the person is asked which visuals when they did not say, and the plan is drawn with addFilter ops. You only see such an ask when something stood in the way, with the reason.",
    '- Before preparing anything that creates or changes a dataset, an analysis or a dashboard, show the plan with show_plan: where the data comes from, each dataset (existing, or new and through which data source), the calculated fields it adds, and the analysis or dashboard (new, edited, or a copy). Reuse existing datasets unless the person asked for a new one. show_plan judges each calculated field against the guidance and tells you what to change.',
    '- When a dataset changed under what reads it (its source, query or columns) and dashboards or analyses on it broke, propose_action POST /api/authoring/datasets/{id}/readers/repair: every reader is checked and its fixes applied in place, previewed first by its /preview twin, which lists each reader with its issues. Do not rebuild or copy the readers, and do not repair them one by one.',
    '- Every dashboard, analysis and dataset keeps its versions: one is kept whenever an export, a refresh or a portal write finds the definition changed, with who changed it (a person when the portal wrote it, "Outside the portal" when an export found it) and what changed in words. context_get shows the last few; GET /api/history/{type}/{id} lists them all, GET /api/history/{type}/{id}/{versionId} reads one, GET /api/history/{type}/{id}/{versionId}/diff compares it with the version before (?against=<versionId> with another, ?against=live with what is live now), and GET /api/history lists what changed lately across the account. When asked what changed, who changed it, when something broke, or to undo a change, read the history first and answer from it. To put a version back, propose_action POST /api/authoring/{type}/{id}/versions/{versionId}/restore: it writes that definition over the live asset as a new version, so nothing is lost.',
    '- A SPICE dataset is refreshed now with propose_action POST /api/ingestions/{datasetId} (body {"type": "FULL_REFRESH"} or INCREMENTAL_REFRESH); the ingestion shows in GET /api/ingestions at once and its status moves as QuickSight runs it. Its schedules are GET /api/assets/dataset/{id}/refresh-schedules (live); one is added with POST there (interval MINUTE15, MINUTE30, HOURLY, DAILY, WEEKLY or MONTHLY; refreshType; timeOfTheDay HH:MM and timezone for daily and longer; dayOfWeek for weekly, dayOfMonth for monthly), changed with PUT .../{scheduleId}, removed with DELETE .../{scheduleId}. A direct query dataset has nothing to refresh.',
    '- Folders are how assets are organised and shared. A new one is propose_action POST /api/folders with a name (and parentFolderId to nest it); DELETE /api/folders/{id} deletes an empty one (?force=true takes its assets out first; nothing else is deleted). GET /api/folders/{id}/permissions lists who can see or work in it with their role; to share it, propose_action POST /api/folders/{id}/members with memberType USER or GROUP, the memberId (the user or group name) and a role (VIEWER, AUTHOR or ADMIN); DELETE /api/folders/{id}/members/{memberId}?type=USER takes someone out. Assets go in with the same members route (memberType DASHBOARD, ANALYSIS, DATASET or DATASOURCE) or many at once with POST /api/folders/{id}/assets/bulk.',
    '- Authoring means: rebind an asset onto other datasets, migrate it onto a layout standard, convert chart types, build visuals from column names, repair what QuickSight refuses, or publish a definition someone edited. To keep the planner to governed datasets, pass their ids as candidateDataSetIds on propose.',
  ].join('\n');
}

const MAX_TEMPLATES = 20;
const MAX_PROJECTS = 30;
const MAX_DATA_SOURCES = 10;
const FIRST_ERROR_STATUS = 400;

function parseData(response: { status: number; body: string }): any {
  if (response.status >= FIRST_ERROR_STATUS) {
    return null;
  }
  try {
    const parsed = JSON.parse(response.body);
    return parsed?.data ?? parsed;
  } catch {
    return null;
  }
}

async function read(dispatch: Dispatch, path: string): Promise<any> {
  try {
    return parseData(await dispatch({ method: 'GET', path }));
  } catch {
    return null;
  }
}

function query(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return pairs.length
    ? `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')}`
    : '';
}

const TEMPLATE_TAGS = JSON.stringify([{ key: 'quicksight-portal:template', value: 'true' }]);

function compactTemplates(
  fieldTemplates: any,
  layoutStandards: any,
  filterBars?: any,
  visualTemplates?: any
): string {
  const templates: any[] = Array.isArray(fieldTemplates?.templates) ? fieldTemplates.templates : [];
  const dashboards: any[] = Array.isArray(layoutStandards?.dashboards)
    ? layoutStandards.dashboards
    : Array.isArray(layoutStandards?.items)
      ? layoutStandards.items
      : [];
  const fieldLines = templates
    .slice(0, MAX_TEMPLATES)
    .map(
      (t) =>
        `- ${t.name} = ${t.expression}${t.description ? ` (${t.description})` : ''} [template ${t.id}]`
    );
  const layoutLines = dashboards
    .slice(0, MAX_TEMPLATES)
    .map((d) => `- ${d.name ?? d.dashboardName} [dashboard ${d.id ?? d.dashboardId}]`);
  return [
    `Calculated-field templates (${templates.length}):`,
    fieldLines.length ? fieldLines.join('\n') : '- none saved yet',
    `Layout standards (${dashboards.length}):`,
    layoutLines.length ? layoutLines.join('\n') : '- no dashboard is tagged as a standard',
    ...(filterBars === undefined ? [] : compactFilterBars(filterBars)),
    ...(visualTemplates === undefined ? [] : compactVisualTemplates(visualTemplates)),
  ].join('\n');
}

function compactVisualTemplates(visualTemplates: any): string[] {
  const list: any[] = Array.isArray(visualTemplates?.templates) ? visualTemplates.templates : [];
  return [
    `Visual templates (${list.length}); add one to a new analysis with visualTemplates: [{ templateId, identifier }] on POST /api/authoring/new, on a dataset that has its columns:`,
    list.length
      ? list
          .slice(0, MAX_TEMPLATES)
          .map((t) => {
            const v = t.visual ?? {};
            const values = (v.values ?? [])
              .map((x: any) => `${x.aggregation ?? 'SUM'}(${x.column})`)
              .join(', ');
            return `- ${t.name}: ${v.type} of ${values}${v.category ? ` by ${v.category}` : ''}${v.granularity ? ` (${v.granularity})` : ''} [visual template ${t.id}]`;
          })
          .join('\n')
      : '- none saved yet',
  ];
}

function compactFilterBars(filterBars: any): string[] {
  const bars: any[] = Array.isArray(filterBars?.templates) ? filterBars.templates : [];
  return [
    `Filter bar templates (${bars.length}); the default is applied to every analysis built from nothing unless filterBarTemplateId says otherwise ('none' for no bar):`,
    bars.length
      ? bars
          .slice(0, MAX_TEMPLATES)
          .map(
            (b) =>
              `- ${b.name}${b.isDefault ? ' (default)' : ''}: ${(b.controls ?? [])
                .map((c: any) => `${c.title ?? c.column} (${c.column}, width ${c.span})`)
                .join(', ')} [filter bar ${b.id}]`
          )
          .join('\n')
      : '- none saved yet',
  ];
}

export async function listTemplates(dispatch: Dispatch): Promise<string> {
  const [fields, standards, bars, visuals] = await Promise.all([
    read(dispatch, '/api/data-catalog/templates/calculated-fields'),
    read(
      dispatch,
      `/api/assets/dashboards/paginated${query({ page: '1', pageSize: String(MAX_TEMPLATES), includeTags: TEMPLATE_TAGS })}`
    ),
    read(dispatch, '/api/data-catalog/templates/filter-bars'),
    read(dispatch, '/api/data-catalog/templates/visuals'),
  ]);
  return compactTemplates(
    fields,
    standards,
    bars ?? { templates: [] },
    visuals ?? { templates: [] }
  );
}

/**
 * The account at a glance, read as the person at the start of an answer.
 * Every section is optional: a failed read says so rather than failing the
 * answer, and never claims SMUS is off when the status could not be read.
 */
export async function buildBrief(dispatch: Dispatch): Promise<string> {
  const [status, catalog, fields, templates, sources] = await Promise.all([
    read(dispatch, '/api/smus/status'),
    read(dispatch, '/api/data-catalog/smus'),
    read(dispatch, '/api/data-catalog/calculated-fields'),
    listTemplates(dispatch),
    read(dispatch, '/api/authoring/datasources'),
  ]);
  const lines: string[] = ['This account right now (read just now, as the person):'];
  if (!status) {
    lines.push(
      '- SMUS status could not be read; check GET /api/smus/status before saying anything about it.'
    );
  } else if (!status.configured) {
    lines.push('- SMUS is not configured for this portal (GET /api/smus/status says so).');
  } else {
    const exported = status.snapshot?.exportedAt ?? catalog?.exportedAt;
    lines.push(
      `- SMUS is configured: domain ${status.domainId ?? '?'} in ${status.region ?? '?'}${exported ? `, last exported ${exported}` : ', not exported yet'}.`
    );
  }
  const projects: any[] = Array.isArray(catalog?.projects) ? catalog.projects : [];
  if (projects.length) {
    lines.push(
      `- Projects (name, id, published listings): ${projects
        .slice(0, MAX_PROJECTS)
        .map((p) => `${p.name} (${p.id}, ${p.count})`)
        .join('; ')}.`
    );
  }
  const assets: any[] = Array.isArray(catalog?.assets) ? catalog.assets : [];
  if (assets.length) {
    const linked = assets.filter((a) => Array.isArray(a.datasets) && a.datasets.length > 0).length;
    lines.push(
      `- ${assets.length} published listings in scope; ${linked} already have a linked QuickSight dataset.`
    );
  }
  const dataSources: any[] = Array.isArray(sources?.dataSources) ? sources.dataSources : [];
  if (dataSources.length) {
    lines.push(
      `- Data sources a new dataset can read through, most used first (name, id, type, datasets reading through it${status?.configured ? ', of which SMUS-linked' : ''}): ${dataSources
        .slice(0, MAX_DATA_SOURCES)
        .map(
          (d) =>
            `${d.name} (${d.id}, ${d.type ?? 'unknown'}, ${d.datasets}${status?.configured ? `, ${d.governedDatasets}` : ''})`
        )
        .join(
          '; '
        )}${dataSources.length > MAX_DATA_SOURCES ? `; and ${dataSources.length - MAX_DATA_SOURCES} more (GET /api/authoring/datasources)` : ''}.`
    );
    if (status?.configured && !dataSources.some((d) => d.type === 'ATHENA')) {
      lines.push(
        '- There is no Athena data source in this account, so a dataset over a SMUS listing cannot be created yet.'
      );
    }
  }
  if (fields?.counts) {
    const c = fields.counts;
    lines.push(
      `- Calculated fields: ${c.fields} distinct across ${c.datasets} datasets; ${c.conflicts} conflicts; ${c.templated} match a template.`
    );
  }
  lines.push(templates);
  return lines.join('\n');
}
