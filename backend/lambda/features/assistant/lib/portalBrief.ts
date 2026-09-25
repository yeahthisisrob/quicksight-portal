/**
 * What the assistant knows about this portal before it reads anything: the
 * concepts the pages are built on (stable, prompt-cached) and a live brief
 * of this account read through the same endpoints the pages use, as the
 * person (SMUS status and projects, governed listings and the datasets
 * linked to them, the calculated-field catalog, the template library and
 * the layout standards). And the compacting the task-shaped tools use, so
 * the model reads a short summary instead of a page of JSON.
 */

export type Dispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

/** How the portal is organised, in the words the person will use. */
export const PORTAL_CONCEPTS = [
  'How this portal is organised:',
  '- SMUS (SageMaker Unified Studio) is where governed data comes from. Tables are published as listings, and every listing belongs to a project. The portal links each listing to the QuickSight datasets that already read it (by table, by SQL, by name, or through a composite dataset built on a linked one); the Data Catalog page shows those links.',
  '- "A SMUS dataset", "the governed dataset", "the linked dataset" or the name of a published table means an existing QuickSight dataset linked to a listing. Find it with find_governed_datasets and use its id. Do not create a dataset (POST /api/smus/assets/{listingId}/dataset) unless the person asks for a new one, or the listing has no linked dataset and they agree.',
  '- Projects scope everything: governed datasets, calculated fields and columns all filter by projectId. When the person names a project, or a listing or dataset that belongs to one, work within it. The brief below lists the projects.',
  '- The data catalog groups every calculated field in the account by what it computes: where it is defined, which datasets and listings it lives on, conflicts (one name, different expressions), lineage both ways, and whether it matches a template. Use find_calculated_fields.',
  '- Templates are of two kinds. The calculated-field template library holds reusable expressions, added to an asset with addCalculatedFields. Layout standards are dashboards tagged quicksight-portal:template=true, applied with `template` on a rebind or new-asset request. Use list_templates.',
  '- Authoring means: rebind an asset onto other datasets, migrate it onto a layout standard, convert chart types, build visuals from column names, repair what QuickSight refuses, or publish a definition someone edited. To keep the planner to governed datasets, pass their ids as candidateDataSetIds on propose.',
].join('\n');

const MAX_LIST = 25;
const MAX_TEMPLATES = 20;
const MAX_PROJECTS = 30;

function parseData(response: { status: number; body: string }): any {
  if (response.status >= 400) {
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

/** One listing and the QuickSight datasets linked to it, on a line. */
export function compactGovernedDatasets(catalog: any): string {
  const assets: any[] = Array.isArray(catalog?.assets) ? catalog.assets : [];
  if (catalog?.configured === false) {
    return 'SMUS is not configured for this portal.';
  }
  if (assets.length === 0) {
    return 'No published listings match.';
  }
  const lines = assets.slice(0, MAX_LIST).map((a) => {
    const datasets: any[] = Array.isArray(a.datasets) ? a.datasets : [];
    const linked = datasets.length
      ? datasets
          .map((d) => `${d.name} (id ${d.id}${d.matchType ? `, by ${d.matchType}` : ''}${d.via?.name ? ` via ${d.via.name}` : ''})`)
          .join('; ')
      : 'no linked QuickSight dataset yet';
    const table = a.table ? ` table ${a.table.database}.${a.table.name}` : '';
    return `- ${a.name} [listing ${a.listingId}; project ${a.projectName ?? a.projectId ?? 'unknown'}${table}] -> ${linked}`;
  });
  const more = assets.length > MAX_LIST ? `\n(${assets.length - MAX_LIST} more; narrow with search or projectId)` : '';
  return `${lines.join('\n')}${more}`;
}

/** Calculated fields, one per distinct expression, with where they live and any conflict. */
export function compactCalculatedFields(catalog: any): string {
  const items: any[] = Array.isArray(catalog?.items) ? catalog.items : [];
  const counts = catalog?.counts;
  const head = counts
    ? `${counts.fields} fields (${counts.names} names, ${counts.conflicts} conflicts, ${counts.templated} match a template)`
    : '';
  if (items.length === 0) {
    return `${head}${head ? '. ' : ''}No calculated fields match.`;
  }
  const lines = items.slice(0, MAX_LIST).map((f) => {
    const where = Array.isArray(f.datasets) ? f.datasets.map((d: any) => d.name ?? d.id).slice(0, 3).join(', ') : '';
    const flags = [f.conflict ? 'CONFLICT' : '', f.template ? `template ${f.template.name ?? ''}`.trim() : '']
      .filter(Boolean)
      .join(', ');
    return `- ${f.name} = ${f.expression} [key ${f.key}${where ? `; on ${where}` : ''}${flags ? `; ${flags}` : ''}]`;
  });
  return `${head}\n${lines.join('\n')}`;
}

export function compactTemplates(fieldTemplates: any, layoutStandards: any): string {
  const templates: any[] = Array.isArray(fieldTemplates?.templates) ? fieldTemplates.templates : [];
  const dashboards: any[] = Array.isArray(layoutStandards?.dashboards)
    ? layoutStandards.dashboards
    : Array.isArray(layoutStandards?.items)
      ? layoutStandards.items
      : [];
  const fieldLines = templates
    .slice(0, MAX_TEMPLATES)
    .map((t) => `- ${t.name} = ${t.expression}${t.description ? ` (${t.description})` : ''} [template ${t.id}]`);
  const layoutLines = dashboards
    .slice(0, MAX_TEMPLATES)
    .map((d) => `- ${d.name ?? d.dashboardName} [dashboard ${d.id ?? d.dashboardId}]`);
  return [
    `Calculated-field templates (${templates.length}):`,
    fieldLines.length ? fieldLines.join('\n') : '- none saved yet',
    `Layout standards (${dashboards.length}):`,
    layoutLines.length ? layoutLines.join('\n') : '- no dashboard is tagged as a standard',
  ].join('\n');
}

export async function findGovernedDatasets(dispatch: Dispatch, search?: string, projectId?: string): Promise<string> {
  return compactGovernedDatasets(
    await read(dispatch, `/api/data-catalog/smus${query({ search, projectId, scope: 'smus' })}`)
  );
}

export async function findCalculatedFields(
  dispatch: Dispatch,
  search?: string,
  projectId?: string,
  conflictsOnly?: boolean
): Promise<string> {
  return compactCalculatedFields(
    await read(
      dispatch,
      `/api/data-catalog/calculated-fields${query({ search, projectId, conflictsOnly: conflictsOnly ? 'true' : undefined })}`
    )
  );
}

export async function listTemplates(dispatch: Dispatch): Promise<string> {
  const [fields, standards] = await Promise.all([
    read(dispatch, '/api/data-catalog/templates/calculated-fields'),
    read(dispatch, `/api/assets/dashboards/paginated${query({ page: '1', pageSize: String(MAX_TEMPLATES), includeTags: TEMPLATE_TAGS })}`),
  ]);
  return compactTemplates(fields, standards);
}

/**
 * The account at a glance, read as the person at the start of an answer.
 * Every section is optional: a failed read says so rather than failing the
 * answer, and never claims SMUS is off when the status could not be read.
 */
export async function buildBrief(dispatch: Dispatch): Promise<string> {
  const [status, catalog, fields, templates] = await Promise.all([
    read(dispatch, '/api/smus/status'),
    read(dispatch, '/api/data-catalog/smus'),
    read(dispatch, '/api/data-catalog/calculated-fields'),
    listTemplates(dispatch),
  ]);
  const lines: string[] = ['This account right now (read just now, as the person):'];
  if (!status) {
    lines.push('- SMUS status could not be read; check GET /api/smus/status before saying anything about it.');
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
    lines.push(`- ${assets.length} published listings in scope; ${linked} already have a linked QuickSight dataset.`);
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
