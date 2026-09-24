import { Box } from '@mui/material';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SmusGate } from '@/entities/smus';
import { loadApiTab } from '@/features/api-reference';
import { AuthorStudio } from '@/features/author';
import { ApiKeysPanel } from '@/features/settings';

import { TabBar } from '@/shared/design-system';
import { PageLoader } from '@/shared/ui';

type AuthorTab = 'studio' | 'api';

const ApiTab = lazy(loadApiTab);

const TABS: Array<{ value: AuthorTab; label: string }> = [
  { value: 'studio', label: 'Studio' },
  { value: 'api', label: 'API' },
];

/**
 * /author?type=dashboard|analysis&id=<assetId> - the Studio, only with an
 * active SMUS project. /author?tab=api - the same authoring by API: how to
 * use an agent with a key, the keys, and every operation. Not gated: a key
 * works whether or not SMUS is configured.
 */
export default function AuthorPage() {
  const [params, setParams] = useSearchParams();
  const tab: AuthorTab = params.get('tab') === 'api' ? 'api' : 'studio';
  const select = (next: AuthorTab) => {
    const copy = new URLSearchParams(params);
    if (next === 'api') {
      copy.set('tab', 'api');
    } else {
      copy.delete('tab');
    }
    setParams(copy, { replace: true });
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TabBar tabs={TABS} value={tab} onChange={select} ariaLabel="Author views" />
      </Box>
      {tab === 'api' ? (
        <Suspense fallback={<PageLoader />}>
          <ApiTab keysPanel={<ApiKeysPanel />} />
        </Suspense>
      ) : (
        <SmusGate subject="Author">
          <AuthorStudio />
        </SmusGate>
      )}
    </Box>
  );
}
