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
  columns?: Array<{ name: string; type: string }>;
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
export function parseListingForms(
  raw: string | undefined
): Pick<CatalogListing, 'table' | 'columns'> {
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
    }))
    .filter((c: { name: string }) => c.name);

  return {
    table:
      database && tableName ? { catalog: glue.catalogId, database, name: tableName } : undefined,
    columns: columns.length > 0 ? columns : undefined,
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
   * Fetch all published listings in the domain (paged sweep). Returns a flat
   * list; matching against QuickSight metadata happens in SmusService.
   */
  public async listAllListings(domainId: string): Promise<CatalogListing[]> {
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
