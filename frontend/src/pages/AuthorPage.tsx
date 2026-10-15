import { Box } from '@mui/material';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

import { loadApiTab } from '@/features/api-reference';
import { loadAssistantTab } from '@/features/assistant';
import { AuthorStudio, type StudioView, studioViewOf } from '@/features/author';
import { ApiKeysPanel } from '@/features/settings';

import { SectionNav } from '@/shared/design-system';
import { PageLoader } from '@/shared/ui';

type AuthorTab = 'assistant' | 'studio' | 'api';
/** A section of the page: a tab, or a view of the Studio. */
type AuthorSection = 'assistant' | 'api' | `studio:${StudioView}`;

const AssistantTab = lazy(loadAssistantTab);
const ApiTab = lazy(loadApiTab);

const SECTIONS: Array<{
  id: AuthorSection;
  label: string;
  children?: Array<{ id: AuthorSection; label: string }>;
}> = [
  { id: 'assistant', label: 'Assistant' },
  {
    id: 'studio:editor',
    label: 'Studio',
    children: [
      { id: 'studio:editor', label: 'Editor' },
      { id: 'studio:templates', label: 'Templates' },
      { id: 'studio:playbooks', label: 'Playbooks' },
      { id: 'studio:knowledge', label: 'Knowledge' },
    ],
  },
  { id: 'api', label: 'API' },
];

/** Params only the Studio reads: a link carrying any of them opens the Studio. */
const STUDIO_PARAMS = ['id', 'type', 'view'];

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
 * change, new assets included. ?tab=studio (or ?type=&id=, ?view=) - the
 * Studio, where existing assets are edited and fixed by hand, templates are
 * kept, account-wide playbooks run and what is known is reviewed; its views
 * are sections under it. ?tab=api - the same authoring by API: the keys and
 * every operation. None of them is gated on SMUS; each uses it when it is
 * configured.
 */
export default function AuthorPage() {
  const [params, setParams] = useSearchParams();
  const tab = authorTabOf(params);
  const section: AuthorSection = tab === 'studio' ? `studio:${studioViewOf(params)}` : tab;
  const select = (next: AuthorSection) => {
    const copy = new URLSearchParams(params);
    const [nextTab, view] = next.split(':') as [AuthorTab, StudioView | undefined];
    copy.set('tab', nextTab);
    if (view && view !== 'editor') {
      copy.set('view', view);
    } else {
      copy.delete('view');
    }
    setParams(copy, { replace: true });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <SectionNav<AuthorSection>
        sections={SECTIONS}
        value={section}
        onChange={select}
        ariaLabel="Author sections"
      >
        {tab === 'api' ? (
          <Suspense fallback={<PageLoader />}>
            <ApiTab keysPanel={<ApiKeysPanel />} />
          </Suspense>
        ) : tab === 'assistant' ? (
          <Suspense fallback={<PageLoader />}>
            <AssistantTab />
          </Suspense>
        ) : (
          <AuthorStudio />
        )}
      </SectionNav>
    </Box>
  );
}
