/**
 * DataZoneAdapter — thin wrapper over the Amazon DataZone SDK used for the
 * SMUS (SageMaker Unified Studio) integration. SMUS domains are DataZone
 * domains under the hood, so catalog lookups go through DataZone APIs.
 *
 * Consumed by SmusService only (adapter → service pattern).
 */
import {
  DataZoneClient,
  GetProjectCommand,
  GetUserProfileCommand,
  ListProjectsCommand,
  SearchListingsCommand,
  type SearchListingsCommandOutput,
} from '@aws-sdk/client-datazone';

import { logger } from '../../shared/utils/logger';

/** One published catalog listing, flattened from the SearchListings shape. */
export interface CatalogListing {
  listingId: string;
  /** Underlying asset id (entityId of the listed asset). */
  assetId: string;
  name: string;
  /** DataZone asset type, e.g. amazon.datazone.GlueTableAssetType. */
  assetType: string;
  description?: string;
  /** The project that published the listing. */
  owningProjectId?: string;
  /** The Glue table behind the listing, when its metadata forms say. */
  table?: { catalog?: string; database: string; name: string };
  /** Columns from the listing's relational table form, in source types. */
  columns?: Array<{ name: string; type: string; description?: string }>;
  /** Glossary terms attached to the listing. */
  glossaryTerms: Array<{ name: string; shortDescription?: string }>;
  /** Every metadata form on the listing, flattened to label/value pairs. */
  forms: Array<{ name: string; fields: Array<{ key: string; value: string }> }>;
  createdAt?: string;
}

export interface CatalogProject {
  id: string;
  name: string;
  description?: string;
}

const PROJECTS_PAGE_SIZE = 50;

/**
 * Metadata forms ride along as one JSON string keyed by form name. The
 * managed Glue data source attaches a GlueTableForm (table ARN, catalog) and
 * a RelationalTableForm (columns). Field names differ across DataZone
 * versions, so each is read defensively; anything missing simply leaves the
 * listing without table identity.
 */
const MAX_FORM_VALUE_LENGTH = 500;
/** Forms nest a few levels at most; the bounds stop a pathological payload. */
const MAX_FORM_DEPTH = 8;
const MAX_FORM_NODES = 2000;

type ListingColumn = { name: string; type: string; description?: string };

/**
 * A form body arrives in more than one shape depending on the call and the
 * domain's version: a nested object, a JSON string of one, or an envelope
 * carrying its content as a JSON string beside a type name. Unwrap whichever
 * turned up; anything else comes back untouched.
 */
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstString(source: Record<string, any>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

const COLUMN_NAME_KEYS = ['columnName', 'ColumnName', 'columnname', 'name', 'Name'] as const;
const COLUMN_TYPE_KEYS = [
  'dataType',
  'DataType',
  'dataTypeName',
  'columnType',
  'type',
  'Type',
] as const;
const COLUMN_DESCRIPTION_KEYS = [
  'columnDescription',
  'ColumnDescription',
  'description',
  'Description',
  'comment',
] as const;
/** Keys a column list hides behind, across form types and DataZone versions. */
const COLUMN_LIST_KEYS = /^(columns?|columndefinitions|schema|fields)$/i;
const TABLE_ARN_KEYS = ['tableArn', 'TableArn', 'tableArnIdentifier'] as const;
const DATABASE_KEYS = ['databaseName', 'DatabaseName', 'database', 'dbName', 'schemaName'] as const;
const TABLE_NAME_KEYS = ['tableName', 'TableName', 'table'] as const;
const CATALOG_KEYS = ['catalogId', 'CatalogId', 'catalog'] as const;

function asListingColumn(raw: unknown): ListingColumn | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const source = raw as Record<string, any>;
  const name = firstString(source, COLUMN_NAME_KEYS);
  if (!name) {
    return undefined;
  }
  const description = firstString(source, COLUMN_DESCRIPTION_KEYS);
  return {
    name,
    type: firstString(source, COLUMN_TYPE_KEYS) ?? '',
    ...(description ? { description } : {}),
  };
}

/** An array is a column list when every entry is an object and some name a column. */
function asColumnList(value: unknown): ListingColumn[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  if (!value.every((v) => v !== null && typeof v === 'object' && !Array.isArray(v))) {
    return undefined;
  }
  const columns = value.map(asListingColumn).filter((c): c is ListingColumn => c !== undefined);
  return columns.length > 0 ? columns : undefined;
}

interface FormScan {
  /** A list under a key that says it holds columns. Trusted first. */
  keyed?: ListingColumn[];
  /** Any list whose entries carry both a name and a type. A weaker signal. */
  typed?: ListingColumn[];
  tableArn?: string;
  databaseName?: string;
  tableName?: string;
  catalogId?: string;
}

function longer(
  current: ListingColumn[] | undefined,
  candidate: ListingColumn[] | undefined
): ListingColumn[] | undefined {
  if (!candidate) {
    return current;
  }
  return !current || candidate.length > current.length ? candidate : current;
}

/**
 * Walk a form tree for the two things a listing is worth reading for: the
 * table it stands for and the columns it names. Which form holds them, and
 * how deep, varies by asset type and domain version, so this looks for the
 * shape rather than for a form called something in particular.
 */
function scanForms(root: unknown, scan: FormScan): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }];
  let visited = 0;
  while (stack.length > 0 && visited < MAX_FORM_NODES) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    visited += 1;
    if (!node || typeof node !== 'object' || depth > MAX_FORM_DEPTH) {
      continue;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        stack.push({ node: parseMaybeJson(entry), depth: depth + 1 });
      }
      continue;
    }
    const source = node as Record<string, any>;
    scan.tableArn ??= firstString(source, TABLE_ARN_KEYS);
    scan.databaseName ??= firstString(source, DATABASE_KEYS);
    scan.tableName ??= firstString(source, TABLE_NAME_KEYS);
    scan.catalogId ??= firstString(source, CATALOG_KEYS);
    for (const [key, rawValue] of Object.entries(source)) {
      const value = parseMaybeJson(rawValue);
      const columns = asColumnList(value);
      if (columns) {
        if (COLUMN_LIST_KEYS.test(key)) {
          scan.keyed = longer(scan.keyed, columns);
          continue;
        }
        // Unkeyed lists of objects are common (glossary terms, owners), so
        // only a list that types its entries counts as a schema.
        if (columns.every((c) => c.type)) {
          scan.typed = longer(scan.typed, columns);
          continue;
        }
      }
      stack.push({ node: value, depth: depth + 1 });
    }
  }
}

/** A form field value as text: scalars as-is, arrays joined, objects as JSON. */
function formValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value) && value.every((v) => typeof v !== 'object')) {
    return value.map(String).join(', ');
  }
  const json = JSON.stringify(value);
  return json.length > MAX_FORM_VALUE_LENGTH
    ? `${json.slice(0, MAX_FORM_VALUE_LENGTH - 1)}\u2026`
    : json;
}

/** Every form as label/value pairs, in the order SMUS returns them. */
function flattenForms(
  forms: Record<string, any>
): Array<{ name: string; fields: Array<{ key: string; value: string }> }> {
  return Object.entries(forms)
    .map(([name, body]) => ({ name, body: parseMaybeJson(body) }))
    .filter(({ body }) => typeof body === 'object' && body !== null && !Array.isArray(body))
    .map(({ name, body }) => ({
      name,
      fields: Object.entries(body as Record<string, unknown>)
        // Column lists are rendered as a table elsewhere, not as a pair.
        .filter(([, value]) => !asColumnList(parseMaybeJson(value)))
        .map(([key, value]) => ({ key, value: formValue(value) }))
        .filter((f) => f.value !== ''),
    }))
    .filter((f) => f.fields.length > 0);
}

export function parseListingForms(
  raw: string | Record<string, any> | undefined
): Pick<CatalogListing, 'table' | 'columns'> & { forms?: CatalogListing['forms'] } {
  if (!raw) {
    return {};
  }
  const parsed = parseMaybeJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  // An array of {formName, content} envelopes is keyed back by name so the
  // display and the scan see the same thing either way.
  const forms: Record<string, any> = Array.isArray(parsed)
    ? Object.fromEntries(
        parsed.map((entry: any, i: number) => [
          String(entry?.formName ?? entry?.typeName ?? i),
          parseMaybeJson(entry?.content ?? entry),
        ])
      )
    : (parsed as Record<string, any>);

  const scan: FormScan = {};
  scanForms(forms, scan);

  // arn:aws:glue:<region>:<account>:table/<database>/<table>
  const arnMatch = scan.tableArn?.match(/:table\/([^/]+)\/(.+)$/);
  const database = arnMatch?.[1] ?? scan.databaseName;
  const tableName = arnMatch?.[2] ?? scan.tableName;
  const columns = scan.keyed ?? scan.typed;

  return {
    table:
      database && tableName ? { catalog: scan.catalogId, database, name: tableName } : undefined,
    columns: columns && columns.length > 0 ? columns : undefined,
    forms: flattenForms(forms),
  };
}

const SEARCH_PAGE_SIZE = 50;
/** Hard cap on catalog sweep size — a runaway-pagination backstop. */
const MAX_LISTINGS = 5000;

export class DataZoneAdapter {
  private readonly client: DataZoneClient;

  public constructor(region: string) {
    this.client = new DataZoneClient({ region });
  }

  /**
   * Fetch published listings (paged sweep): the whole domain, or only one
   * owning project's when `owningProjectId` is given. Returns a flat list;
   * matching against QuickSight metadata happens in SmusService.
   */
  public async listAllListings(
    domainId: string,
    owningProjectId?: string
  ): Promise<CatalogListing[]> {
    const listings: CatalogListing[] = [];
    let nextToken: string | undefined;

    do {
      const response: SearchListingsCommandOutput = await this.client.send(
        new SearchListingsCommand({
          domainIdentifier: domainId,
          maxResults: SEARCH_PAGE_SIZE,
          nextToken,
          // Forms carry the Glue table identity and columns.
          additionalAttributes: ['FORMS'],
          ...(owningProjectId
            ? { filters: { filter: { attribute: 'owningProjectId', value: owningProjectId } } }
            : {}),
        })
      );

      for (const item of response.items || []) {
        const assetListing = item.assetListing;
        if (!assetListing?.listingId || !assetListing.name) {
          continue;
        }
        listings.push({
          listingId: assetListing.listingId,
          assetId: assetListing.entityId || '',
          name: assetListing.name,
          assetType: assetListing.entityType || '',
          description: assetListing.description,
          owningProjectId: assetListing.owningProjectId,
          glossaryTerms: (assetListing.glossaryTerms ?? [])
            .filter((t) => typeof t.name === 'string' && t.name)
            .map((t) => ({ name: t.name as string, shortDescription: t.shortDescription })),
          forms: [],
          createdAt: assetListing.createdAt?.toISOString(),
          ...parseListingForms(assetListing.additionalAttributes?.forms),
        });
      }

      nextToken = response.nextToken;
    } while (nextToken && listings.length < MAX_LISTINGS);

    if (nextToken) {
      logger.warn('SMUS catalog sweep truncated at listing cap', { cap: MAX_LISTINGS });
    }

    return listings;
  }

  /**
   * The domain user profile behind an IAM role, or null when the role has
   * none (then ListProjects cannot return anything for it).
   */
  public async getIamRoleProfile(
    domainId: string,
    roleArn: string
  ): Promise<{ id: string; status: string } | null> {
    try {
      const response = await this.client.send(
        new GetUserProfileCommand({
          domainIdentifier: domainId,
          userIdentifier: roleArn,
          type: 'IAM',
        })
      );
      return response.id ? { id: response.id, status: response.status ?? 'unknown' } : null;
    } catch (error) {
      logger.warn('GetUserProfile failed; the role may have no profile in the domain', {
        roleArn,
        error,
      });
      return null;
    }
  }

  /** One project by id, for naming a publisher ListProjects did not return. */
  public async getProject(domainId: string, projectId: string): Promise<CatalogProject | null> {
    try {
      const response = await this.client.send(
        new GetProjectCommand({ domainIdentifier: domainId, identifier: projectId })
      );
      return response.id && response.name
        ? { id: response.id, name: response.name, description: response.description }
        : null;
    } catch (error) {
      logger.warn('GetProject failed; the project will be shown by id', { projectId, error });
      return null;
    }
  }

  /**
   * The projects ListProjects returns for the caller. Note: DataZone scopes
   * this to projects the calling principal is a member of, so for a service
   * role it is often empty; SmusService unions it with the publishers seen in
   * the catalog sweep.
   */
  public async listProjects(domainId: string): Promise<CatalogProject[]> {
    const projects: CatalogProject[] = [];
    let nextToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListProjectsCommand({
          domainIdentifier: domainId,
          maxResults: PROJECTS_PAGE_SIZE,
          nextToken,
        })
      );
      for (const item of response.items || []) {
        if (item.id && item.name) {
          projects.push({ id: item.id, name: item.name, description: item.description });
        }
      }
      nextToken = response.nextToken;
    } while (nextToken);
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }
}
