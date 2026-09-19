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
    ? `${json.slice(0, MAX_FORM_VALUE_LENGTH - 1)}…`
    : json;
}

/** Every form as label/value pairs, in the order SMUS returns them. */
export function flattenForms(
  forms: Record<string, any>
): Array<{ name: string; fields: Array<{ key: string; value: string }> }> {
  return Object.entries(forms)
    .filter(([, body]) => typeof body === 'object' && body !== null)
    .map(([name, body]) => ({
      name,
      fields: Object.entries(body as Record<string, unknown>)
        // Column lists are rendered as a table elsewhere, not as a pair.
        .filter(([key]) => key !== 'columns')
        .map(([key, value]) => ({ key, value: formValue(value) }))
        .filter((f) => f.value !== ''),
    }))
    .filter((f) => f.fields.length > 0);
}

export function parseListingForms(
  raw: string | undefined
): Pick<CatalogListing, 'table' | 'columns'> & { forms?: CatalogListing['forms'] } {
  if (!raw) {
    return {};
  }
  let forms: Record<string, any>;
  try {
    forms = JSON.parse(raw);
  } catch {
    return {};
  }
  const entries = Object.entries(forms);
  const find = (needle: string) =>
    entries.find(([key]) => key.toLowerCase().includes(needle.toLowerCase()))?.[1];

  const glue = find('GlueTable') ?? {};
  const relational = find('RelationalTable') ?? {};

  // arn:aws:glue:<region>:<account>:table/<database>/<table>
  const arn: string | undefined = glue.tableArn ?? glue.TableArn;
  const arnMatch = typeof arn === 'string' ? arn.match(/:table\/([^/]+)\/(.+)$/) : null;
  const database: string | undefined =
    glue.databaseName ?? glue.database ?? relational.databaseName ?? arnMatch?.[1];
  const tableName: string | undefined = glue.tableName ?? relational.tableName ?? arnMatch?.[2];

  const columnsRaw = Array.isArray(relational.columns) ? relational.columns : [];
  const columns = columnsRaw
    .map((c: any) => ({
      name: String(c?.columnName ?? c?.name ?? ''),
      type: String(c?.dataType ?? c?.type ?? ''),
      ...(typeof c?.columnDescription === 'string' && c.columnDescription
        ? { description: c.columnDescription as string }
        : {}),
    }))
    .filter((c: { name: string }) => c.name);

  return {
    table:
      database && tableName ? { catalog: glue.catalogId, database, name: tableName } : undefined,
    columns: columns.length > 0 ? columns : undefined,
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
