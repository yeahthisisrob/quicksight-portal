/**
 * The playbooks, as cards grouped by what they fix. A card says what it
 * does, what it writes, and whether it deletes; a click opens it.
 */
import { BuildOutlined, CleaningServicesOutlined, StorageOutlined } from '@mui/icons-material';
import { Alert, Box, Card, CardActionArea, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import type { Playbook } from '@/shared/api/modules/playbooks';

const CATEGORIES: Array<{ key: Playbook['category']; label: string; icon: ReactNode }> = [
  { key: 'repair', label: 'Repair', icon: <BuildOutlined fontSize="small" /> },
  { key: 'data', label: 'Data', icon: <StorageOutlined fontSize="small" /> },
  { key: 'cleanup', label: 'Clean up', icon: <CleaningServicesOutlined fontSize="small" /> },
];
const SKELETONS = 3;

function PlaybookCard({ playbook, onOpen }: { playbook: Playbook; onOpen: () => void }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
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
            <Chip key={type} size="small" variant="outlined" label={`Changes ${type}s`} />
          ))}
          {playbook.deletes && (
            <Chip size="small" color="warning" label="Deletes (archived first)" />
          )}
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function PlaybookCatalog({
  playbooks,
  loading,
  error,
  onOpen,
}: {
  playbooks: Playbook[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
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
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
