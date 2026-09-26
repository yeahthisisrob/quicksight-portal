/**
 * The Studio - where existing QuickSight assets are edited and fixed, by
 * hand and deterministically. Three views, chosen by what you came to do:
 *
 *   Editor     one dashboard or analysis: its issues and their fixes, the
 *              visuals on a canvas to move, rename, retype or remove, the
 *              datasets it reads, how it is used; save over it or as a copy.
 *              Or one dataset: where it reads from, what reads it, its
 *              governance. Archived ones open here to be restored.
 *   Templates  the reusable pieces: filter bars, visuals, calculated fields
 *              and layout templates.
 *   Playbooks  fixes across the whole account: scoped, gated, previewed,
 *              chosen, then run, with every asset's outcome kept.
 *
 * Nothing here asks a model or makes something from nothing: that is the
 * Assistant (or the QuickSight console). The view is in the URL (?view=).
 */
import { Box, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import { SegmentedControl } from '@/shared/design-system';

import { type Studio, type StudioOptions, useStudio } from '../model/useStudio';
import { Editor } from './editor/Editor';
import { PlaybooksView } from './playbooks/PlaybooksView';
import { TemplatesView } from './templates/TemplatesView';

export type StudioView = 'editor' | 'templates' | 'playbooks';

const VIEWS: Array<{ value: StudioView; label: string }> = [
  { value: 'editor', label: 'Editor' },
  { value: 'templates', label: 'Templates' },
  { value: 'playbooks', label: 'Playbooks' },
];

const DESCRIPTIONS: Record<StudioView, string> = {
  editor:
    'Fix and shape an existing dashboard, analysis or dataset: its errors, its visuals, where it reads from. Archived ones come back from here. New assets come from the Assistant.',
  templates:
    'The pieces the organisation reuses: filter bars, visuals, calculated fields and layouts. The Assistant and the portal apply them.',
  playbooks:
    'Fixes across the whole account. Each shows what it would touch, and why, before anything changes.',
};

function viewOf(params: URLSearchParams): StudioView {
  const view = params.get('view');
  // 'scripts' was this view's old name; links to it still land here.
  if (view === 'scripts' || view === 'playbooks') return 'playbooks';
  return view === 'templates' ? view : 'editor';
}

/** The Studio with its editor state injected, so stories can drive it. */
export function AuthorStudioView({
  studio,
  view,
  onViewChange,
}: {
  studio: Studio;
  view: StudioView;
  onViewChange: (view: StudioView) => void;
}) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: { md: 'flex-end' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Studio
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {DESCRIPTIONS[view]}
          </Typography>
        </Box>
        <SegmentedControl<StudioView>
          ariaLabel="Studio views"
          value={view}
          onChange={onViewChange}
          options={VIEWS}
        />
      </Box>
      {view === 'templates' ? (
        <TemplatesView />
      ) : view === 'playbooks' ? (
        <PlaybooksView />
      ) : (
        <Editor
          key={
            studio.state.source ? `${studio.state.source.type}/${studio.state.source.id}` : 'browse'
          }
          studio={studio}
        />
      )}
    </Box>
  );
}

export function AuthorStudio(options: StudioOptions = {}) {
  const studio = useStudio(options);
  const [params, setParams] = useSearchParams();
  const view = viewOf(params);
  const select = (next: StudioView) => {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        if (next === 'editor') {
          copy.delete('view');
        } else {
          copy.set('view', next);
        }
        return copy;
      },
      { replace: true }
    );
  };
  return <AuthorStudioView studio={studio} view={view} onViewChange={select} />;
}
