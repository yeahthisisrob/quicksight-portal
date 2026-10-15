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

import { type Studio, type StudioOptions, useStudio } from '../model/useStudio';
import { Editor } from './editor/Editor';
import { KnowledgeView } from './knowledge/KnowledgeView';
import { PlaybooksView } from './playbooks/PlaybooksView';
import { TemplatesView } from './templates/TemplatesView';

export type StudioView = 'editor' | 'templates' | 'playbooks' | 'knowledge';

const DESCRIPTIONS: Record<StudioView, string> = {
  editor:
    'Fix and shape an existing dashboard, analysis or dataset: its errors, its visuals, where it reads from. Archived ones come back from here. New assets come from the Assistant.',
  templates:
    'The pieces the organisation reuses: filter bars, visuals, calculated fields and layouts. The Assistant and the portal apply them.',
  playbooks:
    'Fixes across the whole account. Each shows what it would touch, and why, before anything changes.',
  knowledge:
    'What the portal knows about your assets, columns and fields, by id: what people said, what changed, what a model read into them. Confirm or answer what is open; the assistant and the planner read the rest.',
};

/** The Studio view a URL names (the Author page's section list sets it). */
export function studioViewOf(params: URLSearchParams): StudioView {
  const view = params.get('view');
  // 'scripts' was this view's old name; links to it still land here.
  if (view === 'scripts' || view === 'playbooks') return 'playbooks';
  return view === 'templates' || view === 'knowledge' ? view : 'editor';
}

/** The Studio with its editor state injected, so stories can drive it; the view comes from the page's section list. */
export function AuthorStudioView({ studio, view }: { studio: Studio; view: StudioView }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Studio
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {DESCRIPTIONS[view]}
        </Typography>
      </Box>
      {view === 'templates' ? (
        <TemplatesView />
      ) : view === 'playbooks' ? (
        <PlaybooksView />
      ) : view === 'knowledge' ? (
        <KnowledgeView />
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
  const [params] = useSearchParams();
  return <AuthorStudioView studio={studio} view={studioViewOf(params)} />;
}
