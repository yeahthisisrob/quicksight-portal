/**
 * An asset's JSON in Monaco, read-only: syntax colours, line numbers,
 * folding (Expand/Collapse all), and its own find (Ctrl/Cmd+F). The
 * toolbar's search and highlight chips become Monaco decorations, and the
 * first mark (or the chip's section) is scrolled into view.
 */
import Editor, { type OnMount } from '@monaco-editor/react';
import { alpha, Box, useTheme } from '@mui/material';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { type HighlightType, highlightConfigs } from '../utils/jsonHighlighter';

type MonacoEditor = Parameters<OnMount>[0];
type Decorations = ReturnType<MonacoEditor['createDecorationsCollection']>;

export interface JsonContentHandle {
  foldAll: () => void;
  unfoldAll: () => void;
}

interface JsonContentProps {
  data: unknown;
  highlightType: HighlightType;
  searchTerm: string;
}

const MARK = 'json-viewer-mark';
const SEARCH = 'json-viewer-search';

export const JsonContent = forwardRef<JsonContentHandle, JsonContentProps>(function JsonContentView(
  { data, highlightType, searchTerm },
  ref
) {
  const theme = useTheme();
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorations = useRef<Decorations | null>(null);
  const text = useMemo(() => JSON.stringify(data ?? {}, null, 2), [data]);

  useImperativeHandle(ref, () => ({
    foldAll: () => void editorRef.current?.getAction('editor.foldAll')?.run(),
    unfoldAll: () => void editorRef.current?.getAction('editor.unfoldAll')?.run(),
  }));

  const mark = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const chip = highlightType ? highlightConfigs[highlightType] : null;
    const chipMatches = (chip?.patterns ?? []).flatMap((p) =>
      model.findMatches(p, false, false, false, null, false)
    );
    const search = searchTerm.trim();
    const searchMatches = search ? model.findMatches(search, false, false, false, null, false) : [];
    decorations.current ??= editor.createDecorationsCollection();
    decorations.current.set([
      ...chipMatches.map((m) => ({ range: m.range, options: { inlineClassName: MARK } })),
      ...searchMatches.map((m) => ({ range: m.range, options: { inlineClassName: SEARCH } })),
    ]);
    const jump = chip?.jumpTo
      ? model.findMatches(chip.jumpTo, false, false, true, null, false)[0]
      : undefined;
    const first = jump ?? searchMatches[0] ?? chipMatches[0];
    if (first) editor.revealRangeInCenter(first.range);
  };

  useEffect(mark, [highlightType, searchTerm, text]);

  return (
    <Box
      sx={{
        height: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        [`& .${MARK}`]: { backgroundColor: alpha(theme.palette.primary.main, 0.25) },
        [`& .${SEARCH}`]: { backgroundColor: alpha(theme.palette.warning.main, 0.4) },
      }}
    >
      <Editor
        height="100%"
        language="json"
        value={text}
        theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
        onMount={(editor) => {
          editorRef.current = editor;
          mark();
        }}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          folding: true,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontSize: 12,
          automaticLayout: true,
        }}
      />
    </Box>
  );
});
