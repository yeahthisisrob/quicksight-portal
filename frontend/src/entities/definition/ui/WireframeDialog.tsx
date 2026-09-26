/**
 * WireframeDialog - opens the cached definition of a dashboard or analysis
 * and draws it as a wireframe, with each visual's p90 load time on its card
 * when QuickSight's CloudWatch metrics know it.
 *
 * Reads the same S3 export the JSON viewer shows (and shares its react-query
 * key, so opening one after the other costs nothing). A definition is only
 * present once the asset has been exported with enrichment; until then the
 * dialog says so rather than drawing an empty canvas. Load times come from
 * the insights endpoint, which only dashboards have.
 */
import { ViewQuilt as WireframeIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { assetsApi, authoringApi, getApiErrorMessage } from '@/shared/api';

import { healthBadges } from '../lib/healthBadges';
import { buildWireframeModel } from '../lib/wireframeModel';
import { DefinitionWireframe } from './DefinitionWireframe';

type WireframeAssetType = 'dashboard' | 'analysis';

interface WireframeDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  assetType: WireframeAssetType;
}

const INSIGHTS_STALE_MS = 5 * 60 * 1000;

/** The export stores the raw DescribeXDefinition response under apiResponses.definition. */
export function definitionFromExport(exportData: any): unknown {
  return exportData?.apiResponses?.definition?.data?.Definition ?? exportData?.Definition;
}

export function WireframeDialog({
  open,
  onClose,
  assetId,
  assetName,
  assetType,
}: WireframeDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['asset-json', assetType, assetId],
    queryFn: () => assetsApi.getCachedAsset(assetType, assetId),
    enabled: open && Boolean(assetId),
  });
  // Same key as the Author page, so a dashboard opened there is free here.
  const insights = useQuery({
    queryKey: ['asset-insights', assetType, assetId],
    queryFn: () => authoringApi.getInsights(assetType, assetId),
    enabled: open && Boolean(assetId) && assetType === 'dashboard',
    staleTime: INSIGHTS_STALE_MS,
    retry: false,
  });

  const definition = definitionFromExport(data);
  const model = useMemo(() => (definition ? buildWireframeModel(definition) : null), [definition]);
  const badges = useMemo(() => healthBadges(insights.data), [insights.data]);
  const windowDays = insights.data?.health?.windowDays;

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    body = (
      <Alert severity="error">
        Could not load the cached asset: {getApiErrorMessage(error, 'Unknown error')}
      </Alert>
    );
  } else if (!model) {
    body = (
      <Alert severity="info">
        No definition is cached for this {assetType} yet. Run an export with definitions enabled and
        open the wireframe again.
      </Alert>
    );
  } else {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {badges.size > 0 && windowDays !== undefined && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }} data-testid="load-times">
            Each visual shows its p90 load time over the last {windowDays} days, from CloudWatch.
            Amber is slower than 3 seconds; red failed to load.
          </Typography>
        )}
        <DefinitionWireframe model={model} badges={badges} />
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: { height: '90vh', backgroundColor: 'background.paper', backgroundImage: 'none' },
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WireframeIcon color="primary" />
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }} noWrap>
            {assetName} - Wireframe
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Layout and fields only. No data is shown.
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        {body}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
