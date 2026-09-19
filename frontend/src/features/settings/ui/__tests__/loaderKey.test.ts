import { describe, expect, it } from 'vitest';

import { loaderKey } from '../RemoteMultiSelect';

describe('loaderKey', () => {
  it('maps the route path to itself', () => {
    expect(loaderKey('/settings/smus/projects')).toBe('/settings/smus/projects');
  });

  it('drops a leading /api so an older Lambda still finds the loader', () => {
    expect(loaderKey('/api/settings/smus/projects')).toBe('/settings/smus/projects');
  });

  it('leaves other prefixes alone', () => {
    expect(loaderKey('/apix/settings')).toBe('/apix/settings');
  });
});
