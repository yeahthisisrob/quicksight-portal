/**
 * The context graph's three calls as the assistant uses them, with the
 * answers rendered as short lines a model reads cheaply. The graph is
 * reached through the portal's own API, as the person, like everything
 * else the assistant does; the same calls will point at AWS Context.
 */
import type { KnownColumn } from './planning';

type Dispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

const SEARCH_LIMIT = 15;
const RELATED_LIMIT = 40;
const ATTRIBUTE_LENGTH = 200;
/** The first HTTP status a dispatched request counts as failed at. */
const FIRST_ERROR_STATUS = 400;

function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return pairs.length
    ? `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
}

async function data(
  dispatch: Dispatch,
  path: string
): Promise<{ status: number; data: any; error?: string }> {
  const response = await dispatch({ method: 'GET', path });
  try {
    const parsed = JSON.parse(response.body);
    return { status: response.status, data: parsed?.data, error: parsed?.error };
  } catch {
    return { status: response.status, data: null, error: response.body };
  }
}

function attributes(attrs: Record<string, unknown> | undefined): string {
  const entries = Object.entries(attrs ?? {}).filter(([, v]) => v !== undefined && v !== '');
  return entries.length
    ? ` {${entries.map(([k, v]) => `${k}: ${String(v).slice(0, ATTRIBUTE_LENGTH)}`).join('; ')}}`
    : '';
}

export async function contextSearch(
  dispatch: Dispatch,
  input: { query: string; types?: string[]; projectId?: string; limit?: number }
): Promise<{ ok: boolean; text: string }> {
  const result = await data(
    dispatch,
    `/api/context/search${query({
      q: input.query,
      types: input.types?.join(','),
      projectId: input.projectId,
      limit: Math.min(input.limit ?? SEARCH_LIMIT, SEARCH_LIMIT * 2),
    })}`
  );
  if (result.status >= FIRST_ERROR_STATUS) {
    return { ok: false, text: result.error ?? `Search failed (${result.status})` };
  }
  const hits: any[] = result.data?.hits ?? [];
  if (hits.length === 0) {
    return {
      ok: true,
      text: `Nothing matches "${input.query}". Try other words, a table name, or fewer types.`,
    };
  }
  return {
    ok: true,
    text: hits
      .map(
        (h) =>
          `- ${h.entityId}: ${h.summary}${h.why?.length ? ` [matched ${h.why.join(', ')}]` : ''}`
      )
      .join('\n'),
  };
}

export async function contextGet(
  dispatch: Dispatch,
  entityId: string
): Promise<{ ok: boolean; text: string }> {
  const result = await data(dispatch, `/api/context/entities/${encodeURIComponent(entityId)}`);
  if (result.status >= FIRST_ERROR_STATUS || !result.data?.entity) {
    return { ok: false, text: result.error ?? `No entity ${entityId}` };
  }
  const { entity, relations } = result.data;
  const lines = [
    `${entity.id}: ${entity.summary}${entity.description ? `\n  ${entity.description}` : ''}${attributes(entity.attributes)}`,
    ...(relations as any[]).map(
      (r) =>
        `  ${r.direction === 'out' ? r.relation : `${r.relation} (from)`}: ${r.count} - ${r.examples
          .map((e: any) => `${e.name} (${e.entityId})${e.note ? ` ${e.note}` : ''}`)
          .join('; ')}${r.count > r.examples.length ? '; …' : ''}`
    ),
  ];
  return { ok: true, text: lines.join('\n') };
}

export async function contextRelated(
  dispatch: Dispatch,
  input: {
    entityId: string;
    relations?: string[];
    direction?: string;
    depth?: number;
    types?: string[];
    limit?: number;
  }
): Promise<{ ok: boolean; text: string }> {
  const result = await data(
    dispatch,
    `/api/context/entities/${encodeURIComponent(input.entityId)}/related${query({
      relations: input.relations?.join(','),
      direction: input.direction,
      depth: input.depth,
      types: input.types?.join(','),
      limit: Math.min(input.limit ?? RELATED_LIMIT, RELATED_LIMIT * 2),
    })}`
  );
  if (result.status >= FIRST_ERROR_STATUS) {
    return { ok: false, text: result.error ?? `Related failed (${result.status})` };
  }
  const hits: any[] = result.data?.hits ?? [];
  if (hits.length === 0) {
    return { ok: true, text: `Nothing related to ${input.entityId} that way.` };
  }
  return {
    ok: true,
    text: hits
      .map(
        (h) =>
          `- ${h.entityId}: ${h.summary}${attributes(h.attributes)} (via ${h.via
            .map(
              (v: any) =>
                `${v.direction === 'in' ? '<-' : '->'}${v.relation}${v.note ? ` ${v.note}` : ''}`
            )
            .join(' ')})`
      )
      .join('\n'),
  };
}

/**
 * The columns a dataset has, with the SMUS descriptions of the ones it
 * exposes from a listing: its own column list (live) joined to the
 * listing columns the graph says it exposes.
 */
export async function datasetColumns(
  dispatch: Dispatch,
  dataSetId: string
): Promise<KnownColumn[]> {
  const [own, exposed] = await Promise.all([
    data(dispatch, `/api/authoring/datasets/${encodeURIComponent(dataSetId)}/columns`),
    data(
      dispatch,
      `/api/context/entities/${encodeURIComponent(`dataset:${dataSetId}`)}/related${query({ relations: 'exposes', direction: 'out', limit: 500 })}`
    ),
  ]);
  const described = new Map<string, { type?: string; description?: string }>();
  for (const hit of (exposed.data?.hits ?? []) as any[]) {
    described.set(String(hit.name).toLowerCase(), {
      type: hit.attributes?.type,
      description: hit.description ?? hit.attributes?.description,
    });
  }
  return ((own.data?.columns ?? []) as any[]).map((c) => {
    const extra = described.get(String(c.name).toLowerCase());
    return {
      name: String(c.name),
      ...(c.type || extra?.type ? { type: c.type ?? extra?.type } : {}),
      ...(extra?.description ? { description: extra.description } : {}),
    };
  });
}
