import { Code as JsonIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { assetsApi } from '@/shared/api';

import type { HighlightType } from '../utils/jsonHighlighter';
import { JsonContent, type JsonContentHandle } from './JsonContent';
import { JsonViewerToolbar } from './JsonViewerToolbar';

interface JsonViewerModalProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  assetType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other} style={{ height: '100%' }}>
      {value === index && children}
    </div>
  );
}

/**
 * Map asset type to API parameter (singular form for /cached endpoint)
 */
function getAssetTypeParam(assetType: string): string {
  // The /cached endpoint expects singular form
  return assetType;
}

/**
 * Extract data views from asset data
 */
function extractDataViews(assetData: any, assetType: string) {
  const fullData = assetData || {};
  const definition = fullData.Definition || fullData.DataSet?.Definition || {};

  // Dynamic describe based on asset type
  const describeKey = assetType.charAt(0).toUpperCase() + assetType.slice(1);
  const describe = fullData[describeKey] || fullData.DataSet || {};

  const metadata = fullData['@metadata'] || {};
  const permissions = fullData.Permissions || [];
  const tags = fullData.Tags || [];

  return { fullData, definition, describe, metadata, permissions, tags };
}

/**
 * Hook to manage JSON viewer state
 */
function useJsonViewer(open: boolean) {
  const [activeTab, setActiveTab] = useState(0);
  const [highlightType, setHighlightType] = useState<HighlightType>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setHighlightType(null);
      setSearchTerm('');
    }
  }, [open]);

  return {
    activeTab,
    setActiveTab,
    highlightType,
    setHighlightType,
    searchTerm,
    setSearchTerm,
  };
}

export default function JsonViewerModal({
  open,
  onClose,
  assetId,
  assetName,
  assetType,
}: JsonViewerModalProps) {
  const { enqueueSnackbar } = useSnackbar();
  const contentRef = useRef<JsonContentHandle>(null);

  // State management
  const { activeTab, setActiveTab, highlightType, setHighlightType, searchTerm, setSearchTerm } =
    useJsonViewer(open);

  // Fetch asset data
  const {
    data: assetData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['asset-json', assetType, assetId],
    queryFn: async () => {
      const assetTypeParam = getAssetTypeParam(assetType);
      return await assetsApi.getCachedAsset(assetTypeParam, assetId);
    },
    enabled: open && !!assetId,
  });

  // Extract data views
  const { fullData, definition, describe, metadata, permissions, tags } = extractDataViews(
    assetData,
    assetType
  );

  // Get current tab data
  const getCurrentData = () => {
    const tabData = [fullData, describe, definition, metadata, permissions, tags];
    return tabData[activeTab] || fullData;
  };

  // Handle actions
  const handleCopy = async () => {
    try {
      const currentData = getCurrentData();
      await navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
      enqueueSnackbar('JSON copied to clipboard', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to copy JSON', { variant: 'error' });
    }
  };

  const handleExpandAll = () => contentRef.current?.unfoldAll();
  const handleCollapseAll = () => contentRef.current?.foldAll();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: '90vh',
            backgroundColor: 'background.paper',
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <JsonIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {assetName} - JSON Viewer
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
        <JsonViewerToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          highlightType={highlightType}
          onHighlightChange={setHighlightType}
          onCopy={handleCopy}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onClose={onClose}
        />

        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Full" />
          <Tab label="Describe" />
          <Tab label="Definition" />
          <Tab label="Metadata" />
          <Tab label="Permissions" />
          <Tab label="Tags" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {isLoading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error">Failed to load asset data: {(error as Error).message}</Alert>
          )}

          {!isLoading &&
            !error &&
            [0, 1, 2, 3, 4, 5].map((index) => (
              <TabPanel key={index} value={activeTab} index={index}>
                <JsonContent
                  ref={activeTab === index ? contentRef : null}
                  data={getCurrentData()}
                  highlightType={highlightType}
                  searchTerm={searchTerm}
                />
              </TabPanel>
            ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
