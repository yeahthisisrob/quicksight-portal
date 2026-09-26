import { Box } from '@mui/material';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SmusGate } from '@/entities/smus';
import { loadApiTab } from '@/features/api-reference';
import { loadAssistantTab } from '@/features/assistant';
import { AuthorStudio } from '@/features/author';
import { ApiKeysPanel } from '@/features/settings';

import { TabBar } from '@/shared/design-system';
import { PageLoader } from '@/shared/ui';

type AuthorTab = 'assistant' | 'studio' | 'api';

const AssistantTab = lazy(loadAssistantTab);
const ApiTab = lazy(loadApiTab);

const TABS: Array<{ value: AuthorTab; label: string }> = [
  { value: 'assistant', label: 'Assistant' },
  { value: 'studio', label: 'Studio' },
  { value: 'api', label: 'API' },
];

/** Params only the Studio reads: a link carrying any of them opens the Studio. */
const STUDIO_PARAMS = ['id', 'type', 'new'];

/** The tab in the URL, else Studio when the link is a Studio link, else the Assistant. */
function authorTabOf(params: URLSearchParams): AuthorTab {
  const tab = params.get('tab');
  if (tab === 'assistant' || tab === 'studio' || tab === 'api') {
    return tab;
  }
  return STUDIO_PARAMS.some((p) => params.has(p)) ? 'studio' : 'assistant';
}

/**
 * /author - the Assistant: ask, and it plans, previews and prepares the
 * change. ?tab=studio (or ?type=&id=) - the Studio, only with an active SMUS
 * project. ?tab=api - the same authoring by API: the keys and every
 * operation; not gated, a key works whether or not SMUS is configured.
 */
export default function AuthorPage() {
  const [params, setParams] = useSearchParams();
  const tab = authorTabOf(params);
  const select = (next: AuthorTab) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
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
      ) : tab === 'assistant' ? (
        <Suspense fallback={<PageLoader />}>
          <AssistantTab />
        </Suspense>
      ) : (
        <SmusGate subject="Author">
          <AuthorStudio />
        </SmusGate>
      )}
    </Box>
  );
}
