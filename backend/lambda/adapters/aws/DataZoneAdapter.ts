/**
 * DataZoneAdapter — thin wrapper over the Amazon DataZone SDK used for the
 * SMUS (SageMaker Unified Studio) integration. SMUS domains are DataZone
 * domains under the hood, so catalog lookups go through DataZone APIs.
 *
 * Consumed by SmusService only (adapter → service pattern).
 */
import {
  DataZoneClient,
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
}

const SEARCH_PAGE_SIZE = 50;
/** Hard cap on catalog sweep size — a runaway-pagination backstop. */
const MAX_LISTINGS = 5000;

export class DataZoneAdapter {
  private readonly client: DataZoneClient;

  constructor(region: string) {
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
        });
      }

      nextToken = response.nextToken;
    } while (nextToken && listings.length < MAX_LISTINGS);

    if (nextToken) {
      logger.warn('SMUS catalog sweep truncated at listing cap', { cap: MAX_LISTINGS });
    }

    return listings;
  }
}
