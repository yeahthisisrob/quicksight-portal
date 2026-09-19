/**
 * Whether SageMaker Unified Studio is usable from this portal. Author and the
 * catalog are built on SMUS projects, so there is nothing to show until the
 * domain is configured and at least one project is reachable.
 */
import type { SmusProjectDiagnostics, SmusProjectsResponse } from '@/shared/api/modules/settings';

export type SmusReadiness = 'not-configured' | 'no-projects' | 'ready';

export function smusReadiness(response: SmusProjectsResponse): SmusReadiness {
  if (!response.configured) {
    return 'not-configured';
  }
  return response.projects.length > 0 ? 'ready' : 'no-projects';
}

/** One paragraph on why the project list came back empty, for an empty state. */
export function describeProjectDiagnostics(
  d: SmusProjectDiagnostics | undefined
): string | undefined {
  if (!d) {
    return undefined;
  }
  return [
    `Looked in domain ${d.domainId} (${d.region}): ${d.fromListProjects} from ListProjects, ${d.listings} published listings, ${d.publishers} publishers.`,
    d.listProjectsError ? `ListProjects failed: ${d.listProjectsError}` : '',
    d.listingsError ? `SearchListings failed: ${d.listingsError}` : '',
    d.listings === 0 && !d.listingsError
      ? 'No published listings, so there is nothing to derive projects from: check the domain id and region, and that assets are published.'
      : '',
    d.roleArn ? `Calling DataZone as ${d.roleArn} (domain profile: ${d.profileStatus}).` : '',
    d.profileStatus === 'not found'
      ? 'That role has no user profile in the domain, so it is a member of nothing: run `just smus-grant <domain>` or add the role in the SMUS console.'
      : d.fromListProjects === 0 && !d.listProjectsError
        ? 'The role is known to the domain but is a member of no project: add it to the projects it should read (`just smus-grant <domain>` does this too).'
        : '',
  ]
    .filter(Boolean)
    .join(' ');
}
