/**
 * The tool UIs for what the assistant drew. It hands references, not
 * payloads: each card fetches what it draws (or re-runs the read-only
 * preview) and shows it compact in the thread, full size on Expand.
 *
 * - show_wireframe: a preview of what a change would publish, or an asset
 *   as it is, drawn as a wireframe.
 * - show_lineage: a calculated field's lineage.
 * - show_plan: what a change will build, sources to asset, and who drew it.
 * - show_field_verdicts: where each calculated field it adds belongs.
 */
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import {
  AccountTree,
  Calculate,
  Route as PlanIcon,
  ViewQuilt,
  WarningAmber,
} from '@mui/icons-material';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  buildWireframeModel,
  DefinitionWireframe,
  definitionFromExport,
  type WireframeModel,
} from '@/entities/definition';
import { FieldLineageGraph } from '@/entities/field';

import { assetsApi, assistantApi, getApiErrorMessage } from '@/shared/api';
import type { AssistantArtifact } from '@/shared/api/modules/assistant';
import { fieldCatalogApi } from '@/shared/api/modules/data-catalog';

import { buildSummary, wireframeSummary } from '../../lib/summaries';
import type { ArtifactArgs } from '../../model/thread';
import { FieldVerdicts } from '../FieldVerdicts';
import { PlanLineage } from '../PlanLineage';
import { ArtifactCard, PreviewNote, Thumbnail } from './ArtifactCard';

const MAX_WARNINGS = 5;
const LINEAGE_THUMB_SCALE = 0.75;
const EXPANDED_LINEAGE_HEIGHT = 640;
/** Tall enough never to scroll inside the thumbnail, which clips it instead. */
const THUMB_LINEAGE_HEIGHT = 1_000;

type ArtifactTool = ToolCallMessagePartComponent<ArtifactArgs, unknown>;

interface DrawnDefinition {
  model: WireframeModel | null;
  warnings: string[];
  refused: boolean;
}

/** The definition an artifact names, drawn: a preview re-run, or the asset's cached export. */
function useArtifactWireframe(artifact: AssistantArtifact) {
  const isPreview = artifact.kind === 'preview';
  const preview = useQuery({
    queryKey: ['assistant-preview', artifact.path, JSON.stringify(artifact.body ?? {})],
    queryFn: () => assistantApi.rerunPreview(artifact),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: isPreview,
  });
  const asset = useQuery({
    queryKey: ['asset-json', artifact.assetType, artifact.assetId],
    queryFn: () =>
      assetsApi.getCachedAsset(artifact.assetType ?? 'dashboard', artifact.assetId ?? ''),
    enabled: !isPreview,
  });
  const query = isPreview ? preview : asset;
  const drawn = useMemo((): DrawnDefinition | null => {
    if (!query.data) return null;
    if (!isPreview) {
      const definition = definitionFromExport(asset.data);
      return {
        model: definition ? buildWireframeModel(definition) : null,
        warnings: [],
        refused: false,
      };
    }
    const data = (preview.data ?? {}) as Record<string, any>;
    // Most previews return the definition; the definition check draws the one it was given.
    const definition = data.definition ?? (artifact.body as any)?.definition;
    return {
      model: definition ? buildWireframeModel(definition) : null,
      warnings: [
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        ...(Array.isArray(data.issues) ? data.issues.map((i: any) => i.message) : []),
      ],
      refused: data.canApply === false,
    };
  }, [query.data, isPreview, asset.data, preview.data, artifact.body]);
  return { drawn, isLoading: query.isLoading, error: query.error };
}

function Warnings({ drawn }: { drawn: DrawnDefinition }) {
  const { warnings, refused } = drawn;
  return (
    <>
      {refused && <Alert severity="error">QuickSight would refuse this as it stands.</Alert>}
      {warnings.length > 0 && (
        <Alert severity="warning">
          {warnings.slice(0, MAX_WARNINGS).map((w) => (
            <div key={w}>{w}</div>
          ))}
          {warnings.length > MAX_WARNINGS && <div>…and {warnings.length - MAX_WARNINGS} more</div>}
        </Alert>
      )}
    </>
  );
}

function WarningCount({ drawn }: { drawn: DrawnDefinition }) {
  const n = drawn.warnings.length + (drawn.refused ? 1 : 0);
  if (n === 0) return null;
  return (
    <Chip
      size="small"
      color={drawn.refused ? 'error' : 'warning'}
      variant="outlined"
      icon={<WarningAmber />}
      label={drawn.refused ? 'Would be refused' : `${n} warning${n === 1 ? '' : 's'}`}
      sx={{ height: 20, fontSize: '0.6875rem', flexShrink: 0 }}
    />
  );
}

const WIREFRAME_KIND: Record<string, string> = {
  preview: 'What it would publish',
  asset: 'As it is now',
};

/** A wireframe as a compact card; the one inside a prepared action uses it too. */
export function WireframeArtifact({ artifact }: { artifact: AssistantArtifact }) {
  const { drawn, isLoading, error } = useArtifactWireframe(artifact);
  const failure = error
    ? getApiErrorMessage(
        error,
        artifact.kind === 'preview'
          ? 'The preview could not be drawn'
          : 'The asset could not be read'
      )
    : null;

  const summary = isLoading
    ? 'Drawing…'
    : failure
      ? 'Could not draw it'
      : drawn?.model
        ? wireframeSummary(drawn.model)
        : 'Nothing to draw';

  const preview = isLoading ? (
    <PreviewNote>
      <CircularProgress size={18} />
      <Typography variant="caption">
        {artifact.kind === 'preview' ? 'Drawing the preview' : 'Reading the asset'}
      </Typography>
    </PreviewNote>
  ) : failure ? (
    <PreviewNote>
      <Typography variant="caption">{failure}</Typography>
    </PreviewNote>
  ) : drawn?.model ? (
    <Thumbnail>
      <DefinitionWireframe model={drawn.model} hideSummary />
    </Thumbnail>
  ) : (
    <PreviewNote>
      <Typography variant="caption">Nothing to draw.</Typography>
    </PreviewNote>
  );

  return (
    <ArtifactCard
      icon={<ViewQuilt />}
      kind={WIREFRAME_KIND[artifact.kind] ?? 'Wireframe'}
      title={artifact.title}
      summary={summary}
      model={artifact.model?.label}
      preview={
        <>
          {drawn && (
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
              <WarningCount drawn={drawn} />
            </Box>
          )}
          {preview}
        </>
      }
      expanded={
        <Stack spacing={1.5}>
          {failure && <Alert severity="warning">{failure}</Alert>}
          {drawn && <Warnings drawn={drawn} />}
          {drawn?.model ? (
            <DefinitionWireframe model={drawn.model} />
          ) : (
            !failure && <Typography variant="body2">Nothing to draw.</Typography>
          )}
        </Stack>
      }
    />
  );
}

export const WireframeTool: ArtifactTool = ({ args }) =>
  args?.artifact ? <WireframeArtifact artifact={args.artifact} /> : null;

function openField(key: string) {
  window.open(
    `/data-catalog?tab=calculated-fields&field=${encodeURIComponent(key)}`,
    '_blank',
    'noopener'
  );
}

function LineageArtifact({ artifact }: { artifact: AssistantArtifact }) {
  const detail = useQuery({
    queryKey: ['calculated-field', artifact.fieldKey],
    queryFn: () => fieldCatalogApi.calculatedField(artifact.fieldKey ?? ''),
  });
  const data = detail.data;
  const failure =
    detail.error || (!detail.isLoading && !data)
      ? getApiErrorMessage(detail.error, 'The lineage could not be read')
      : null;
  const nodes = data?.lineage.nodes.length ?? 0;

  return (
    <ArtifactCard
      icon={<AccountTree />}
      kind="Lineage"
      title={artifact.title}
      summary={
        detail.isLoading
          ? 'Tracing…'
          : data
            ? `${data.name} = ${data.expression} · ${nodes} field${nodes === 1 ? '' : 's'}`
            : 'Could not trace it'
      }
      preview={
        detail.isLoading ? (
          <PreviewNote>
            <CircularProgress size={18} />
            <Typography variant="caption">Tracing the lineage</Typography>
          </PreviewNote>
        ) : data ? (
          <Thumbnail scale={LINEAGE_THUMB_SCALE}>
            <FieldLineageGraph
              lineage={data.lineage}
              focusKey={data.key}
              maxHeight={THUMB_LINEAGE_HEIGHT}
              onOpenField={openField}
            />
          </Thumbnail>
        ) : (
          <PreviewNote>
            <Typography variant="caption">{failure}</Typography>
          </PreviewNote>
        )
      }
      expanded={
        data ? (
          <Stack spacing={1}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', color: 'text.secondary', overflowWrap: 'anywhere' }}
            >
              {data.name} = {data.expression}
            </Typography>
            <FieldLineageGraph
              lineage={data.lineage}
              focusKey={data.key}
              maxHeight={EXPANDED_LINEAGE_HEIGHT}
              onOpenField={openField}
            />
          </Stack>
        ) : (
          <Alert severity="warning">{failure ?? 'Still tracing the lineage.'}</Alert>
        )
      }
    />
  );
}

export const LineageTool: ArtifactTool = ({ args }) =>
  args?.artifact ? <LineageArtifact artifact={args.artifact} /> : null;

function planSummary(plan: AssistantArtifact): string {
  const built = buildSummary(plan.build);
  if (built) return built;
  const asset = plan.asset ? `${plan.asset.status} ${plan.asset.kind}` : null;
  const datasets = plan.datasets?.length
    ? `${plan.datasets.length} dataset${plan.datasets.length === 1 ? '' : 's'}`
    : null;
  return [asset, datasets].filter(Boolean).join(' · ');
}

export const PlanTool: ArtifactTool = ({ args }) => {
  const plan = args?.artifact;
  if (!plan) return null;
  return (
    <ArtifactCard
      icon={<PlanIcon />}
      kind="Plan"
      title={plan.title}
      summary={planSummary(plan)}
      model={plan.model?.label}
      preview={<PlanLineage plan={plan} />}
      fit
      expanded={<PlanLineage plan={plan} />}
    />
  );
};

export const FieldsTool: ArtifactTool = ({ args }) => {
  const artifact = args?.artifact;
  if (!artifact) return null;
  const fields = artifact.fields ?? [];
  return (
    <ArtifactCard
      icon={<Calculate />}
      kind="Calculated fields"
      title={artifact.title}
      summary={`${fields.length} field${fields.length === 1 ? '' : 's'}, each placed by your field strategy`}
      preview={<FieldVerdicts fields={fields} />}
      fit
      expanded={<FieldVerdicts fields={fields} />}
    />
  );
};
