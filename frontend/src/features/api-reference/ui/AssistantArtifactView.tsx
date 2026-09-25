/**
 * What the assistant put in front of the person, drawn: a preview as the
 * wireframe of what it would publish, an asset as it is now, a calculated
 * field as its lineage. The assistant hands references, not payloads; each
 * card fetches (or re-runs the read-only preview) itself.
 */
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  buildWireframeModel,
  DefinitionWireframe,
  definitionFromExport,
} from '@/entities/definition';
import { FieldLineageGraph } from '@/entities/field';

import { assetsApi, assistantApi, getApiErrorMessage } from '@/shared/api';
import type { AssistantArtifact } from '@/shared/api/modules/assistant';
import { fieldCatalogApi } from '@/shared/api/modules/data-catalog';

const LINEAGE_HEIGHT = 320;
const MAX_WARNINGS = 5;

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 1.5,
          py: 0.75,
          fontWeight: 700,
          borderBottom: 1,
          borderColor: 'divider',
          color: 'text.secondary',
        }}
      >
        {title}
      </Typography>
      <Box sx={{ p: 1.5 }}>{children}</Box>
    </Box>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
      <CircularProgress size={14} />
      <Typography variant="caption">{what}</Typography>
    </Stack>
  );
}

function Wireframe({ definition }: { definition: unknown }) {
  const model = useMemo(() => (definition ? buildWireframeModel(definition) : null), [definition]);
  if (!model) {
    return <Typography variant="caption">Nothing to draw.</Typography>;
  }
  return <DefinitionWireframe model={model} />;
}

function PreviewCard({ artifact }: { artifact: AssistantArtifact }) {
  const preview = useQuery({
    queryKey: ['assistant-preview', artifact.path, JSON.stringify(artifact.body ?? {})],
    queryFn: () => assistantApi.rerunPreview(artifact),
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (preview.isLoading) {
    return <Loading what="Drawing the preview" />;
  }
  if (preview.error) {
    return (
      <Alert severity="warning">
        {getApiErrorMessage(preview.error, 'The preview could not be drawn')}
      </Alert>
    );
  }
  const data = preview.data ?? {};
  // Most previews return the definition; the definition check draws the one it was given.
  const definition = data.definition ?? (artifact.body as any)?.definition;
  const warnings: string[] = [
    ...(Array.isArray(data.warnings) ? data.warnings : []),
    ...(Array.isArray(data.issues) ? data.issues.map((i: any) => i.message) : []),
  ];
  return (
    <Stack spacing={1}>
      {data.canApply === false && (
        <Alert severity="error">QuickSight would refuse this as it stands.</Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning">
          {warnings.slice(0, MAX_WARNINGS).map((w) => (
            <div key={w}>{w}</div>
          ))}
          {warnings.length > MAX_WARNINGS && <div>…and {warnings.length - MAX_WARNINGS} more</div>}
        </Alert>
      )}
      <Wireframe definition={definition} />
    </Stack>
  );
}

function AssetCard({ artifact }: { artifact: AssistantArtifact }) {
  const asset = useQuery({
    queryKey: ['asset-json', artifact.assetType, artifact.assetId],
    queryFn: () =>
      assetsApi.getCachedAsset(artifact.assetType ?? 'dashboard', artifact.assetId ?? ''),
  });
  if (asset.isLoading) {
    return <Loading what="Reading the asset" />;
  }
  if (asset.error) {
    return (
      <Alert severity="warning">
        {getApiErrorMessage(asset.error, 'The asset could not be read')}
      </Alert>
    );
  }
  return <Wireframe definition={definitionFromExport(asset.data)} />;
}

function LineageCard({ artifact }: { artifact: AssistantArtifact }) {
  const detail = useQuery({
    queryKey: ['calculated-field', artifact.fieldKey],
    queryFn: () => fieldCatalogApi.calculatedField(artifact.fieldKey ?? ''),
  });
  if (detail.isLoading) {
    return <Loading what="Tracing the lineage" />;
  }
  if (detail.error || !detail.data) {
    return (
      <Alert severity="warning">
        {getApiErrorMessage(detail.error, 'The lineage could not be read')}
      </Alert>
    );
  }
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
        {detail.data.name} = {detail.data.expression}
      </Typography>
      <FieldLineageGraph
        lineage={detail.data.lineage}
        focusKey={detail.data.key}
        maxHeight={LINEAGE_HEIGHT}
        onOpenField={(key) =>
          window.open(
            `/data-catalog?tab=calculated-fields&field=${encodeURIComponent(key)}`,
            '_blank',
            'noopener'
          )
        }
      />
    </Stack>
  );
}

export function AssistantArtifactView({ artifact }: { artifact: AssistantArtifact }) {
  const title =
    artifact.kind === 'preview'
      ? `${artifact.title} · what it would publish`
      : artifact.kind === 'asset'
        ? `${artifact.title} · as it is now`
        : `${artifact.title} · lineage`;
  return (
    <Frame title={title}>
      {artifact.kind === 'preview' ? (
        <PreviewCard artifact={artifact} />
      ) : artifact.kind === 'asset' ? (
        <AssetCard artifact={artifact} />
      ) : (
        <LineageCard artifact={artifact} />
      )}
    </Frame>
  );
}
