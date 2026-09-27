/**
 * The playbooks, as cards grouped by what they fix. A card says what it
 * does, what it writes, and whether it deletes; a click opens it.
 */
import {
  Add,
  BuildOutlined,
  CleaningServicesOutlined,
  ContentCopy,
  DeleteOutlined,
  EditOutlined,
  PersonOutlined,
  StorageOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';

import type { Playbook } from '@/shared/api/modules/playbooks';

const CATEGORIES: Array<{ key: Playbook['category']; label: string; icon: ReactNode }> = [
  { key: 'repair', label: 'Repair', icon: <BuildOutlined fontSize="small" /> },
  { key: 'data', label: 'Data', icon: <StorageOutlined fontSize="small" /> },
  { key: 'cleanup', label: 'Clean up', icon: <CleaningServicesOutlined fontSize="small" /> },
  { key: 'custom', label: 'Yours', icon: <PersonOutlined fontSize="small" /> },
];

/** What a card can do beyond opening: copy anything built from a spec, change or delete your own. */
export interface CatalogActions {
  onCreate?: () => void;
  onCopy?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}
const SKELETONS = 3;

const WRITES: Record<string, string> = {
  dashboard: 'Changes dashboards',
  analysis: 'Changes analyses',
  dataset: 'Changes datasets',
  datasource: 'Changes data sources',
  folder: 'Files into folders',
};

function PlaybookCard({
  playbook,
  onOpen,
  actions,
}: {
  playbook: Playbook;
  onOpen: () => void;
  actions: CatalogActions;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <CardActionArea
        onClick={onOpen}
        sx={{
          p: 2.5,
          height: '100%',
          alignItems: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid={`playbook-${playbook.id}`}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {playbook.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, flex: 1 }}>
          {playbook.description}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
          {playbook.writes.map((type) => (
            <Chip
              key={type}
              size="small"
              variant="outlined"
              label={WRITES[type] ?? `Changes ${type}`}
            />
          ))}
          {playbook.deletes && <Chip size="small" color="warning" label="Deletes" />}
          {playbook.infers && (
            <Chip size="small" variant="outlined" color="info" label="Asks a model" />
          )}
        </Stack>
      </CardActionArea>
      {(playbook.composable || playbook.custom) && (
        <CardActions sx={{ pt: 0, px: 1.5, justifyContent: 'flex-end' }}>
          {playbook.composable && actions.onCopy && (
            <Tooltip title="Copy into a new playbook">
              <IconButton
                size="small"
                aria-label="Copy"
                onClick={() => actions.onCopy!(playbook.id)}
              >
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {playbook.custom && actions.onEdit && (
            <Tooltip title="Change">
              <IconButton
                size="small"
                aria-label="Change"
                onClick={() => actions.onEdit!(playbook.id)}
              >
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {playbook.custom && actions.onDelete && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                aria-label="Delete"
                onClick={() => actions.onDelete!(playbook.id)}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
}

export function PlaybookCatalog({
  playbooks,
  loading,
  error,
  onOpen,
  actions = {},
}: {
  playbooks: Playbook[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  actions?: CatalogActions;
}) {
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  const grid = {
    display: 'grid',
    gap: 2,
    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
  };
  if (loading) {
    return (
      <Box sx={grid}>
        {Array.from({ length: SKELETONS }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={160} />
        ))}
      </Box>
    );
  }
  return (
    <Stack spacing={3}>
      {actions.onCreate && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<Add />} onClick={actions.onCreate}>
            New playbook
          </Button>
        </Stack>
      )}
      {CATEGORIES.map(({ key, label, icon }) => {
        const inCategory = playbooks.filter((p) => p.category === key);
        if (inCategory.length === 0) return null;
        return (
          <Box key={key}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', mb: 1, color: 'text.secondary' }}
            >
              {icon}
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.8 }}>
                {label}
              </Typography>
            </Stack>
            <Box sx={grid}>
              {inCategory.map((playbook) => (
                <PlaybookCard
                  key={playbook.id}
                  playbook={playbook}
                  onOpen={() => onOpen(playbook.id)}
                  actions={actions}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
