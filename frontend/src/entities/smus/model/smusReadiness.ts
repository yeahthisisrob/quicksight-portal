/**
 * Whether SageMaker Unified Studio is usable from this portal. Author and the
 * catalog are built on SMUS projects, so there is nothing to show until a
 * domain is set and at least one project is selected in Settings. Both come
 * from the settings snapshot, so no catalog sweep is needed to decide.
 */
import type { SettingsSnapshot, SmusProjectDiagnostics } from '@/shared/api/modules/settings';

export type SmusReadiness = 'not-configured' | 'no-projects' | 'ready';

export const SMUS_DOMAIN_KEY = 'smus.domainId';
export const SMUS_PROJECTS_KEY = 'smus.projectIds';

function settingValue(snapshot: SettingsSnapshot, key: string): unknown {
  for (const group of snapshot.groups) {
    const found = group.settings.find((s) => s.key === key);
    if (found) {
      return found.value;
    }
  }
  return undefined;
}

/** The project ids selected in Settings (env or stored). */
export function selectedProjectIds(snapshot: SettingsSnapshot): string[] {
  const value = settingValue(snapshot, SMUS_PROJECTS_KEY);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function smusReadiness(snapshot: SettingsSnapshot): SmusReadiness {
  const domain = settingValue(snapshot, SMUS_DOMAIN_KEY);
  if (typeof domain !== 'string' || !domain.trim()) {
    return 'not-configured';
  }
  return selectedProjectIds(snapshot).length > 0 ? 'ready' : 'no-projects';
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
