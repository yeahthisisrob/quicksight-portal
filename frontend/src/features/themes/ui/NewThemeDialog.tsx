/**
 * Make a theme. Start from a picture (a brand palette, a logo, a style
 * guide, a screenshot of a layout): a model that reads images drafts one,
 * as a job. Or start from scratch. Either way the draft is edited here,
 * previewed on a sketch of a sheet, and only created when someone presses
 * Create.
 */
import { AddPhotoAlternateOutlined, AutoAwesome, Close } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { type ChangeEvent, useRef, useState } from 'react';

import { ModelPill, useAiModels } from '@/entities/ai-model';

import { themesApi } from '@/shared/api';
import { BUILT_IN_THEMES, type ThemeDraft } from '@/shared/api/modules/themes';
import { useAiModel } from '@/shared/lib';
import { announceAssetChanges } from '@/shared/lib/assetChanges';

import {
  BLANK_DRAFT,
  draftProblems,
  EDITABLE_ROLES,
  imageProblem,
  MAX_DATA_COLORS,
} from '../lib/themeDraft';
import { ThemePreview } from './ThemePreview';

/** A color well and its hex, kept in step. */
function ColorField({
  label,
  value,
  onChange,
  onRemove,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
  /** Shown when empty; an empty field is then allowed. */
  placeholder?: string;
}) {
  const valid = /^#[0-9A-F]{6}$/i.test(value) || (placeholder !== undefined && value === '');
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box
        component="input"
        type="color"
        value={/^#[0-9A-F]{6}$/i.test(value) ? value : '#FFFFFF'}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value.toUpperCase())}
        sx={{ width: 32, height: 32, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
      />
      <TextField
        size="small"
        label={label}
        value={value}
        error={!valid}
        placeholder={placeholder}
        slotProps={placeholder !== undefined ? { inputLabel: { shrink: true } } : undefined}
        onChange={(e) => onChange(e.target.value.trim().toUpperCase())}
        sx={{ width: 150 }}
      />
      {onRemove && (
        <IconButton size="small" onClick={onRemove}>
          <Close fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function NewThemeDialog({
  open,
  onClose,
  onCreated,
  initialDraft = null,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (theme: { themeId: string; arn: string }) => void;
  /** Open on the editor with this draft, skipping the picture. */
  initialDraft?: ThemeDraft | null;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const models = useAiModels();
  const [model] = useAiModel('authoring');
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ThemeDraft | null>(initialDraft);
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rationale, setRationale] = useState<string | undefined>();

  const propose = useMutation({
    mutationFn: () => themesApi.proposeFromImage(image!, note, model),
    onSuccess: (proposal) => {
      setDraft(proposal.draft);
      setRationale(proposal.rationale);
    },
  });

  const create = useMutation({
    mutationFn: (d: ThemeDraft) => themesApi.create(d),
    onSuccess: (created) => {
      enqueueSnackbar(`Created the theme ${draft?.name}`, { variant: 'success' });
      for (const warning of created.warnings) enqueueSnackbar(warning, { variant: 'warning' });
      announceAssetChanges(['theme']);
      onCreated?.(created);
      close();
    },
  });

  function close() {
    setDraft(null);
    setImage(null);
    setImageError(null);
    setNote('');
    setRationale(undefined);
    propose.reset();
    create.reset();
    onClose();
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageProblem(file);
    setImageError(problem);
    if (!problem) setImage(await readAsDataUrl(file));
  }

  const set = (patch: Partial<ThemeDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setDataColor = (i: number, hex: string) =>
    set({ dataColors: draft!.dataColors.map((c, j) => (j === i ? hex : c)) });
  // An emptied role goes back to what the base theme gives it.
  const setRole = (role: string, hex: string) => {
    const { [role]: _, ...rest } = draft!.uiColors ?? {};
    set({ uiColors: hex ? { ...rest, [role]: hex } : rest });
  };
  const problems = draft ? draftProblems(draft) : [];

  return (
    <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
      <DialogTitle>New theme</DialogTitle>
      <DialogContent dividers>
        {!draft ? (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Start from a picture of your brand colors, a logo, a style guide or a layout you like,
              and a model drafts a theme that goes with it. You check and edit it before anything is
              created.
            </Typography>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <ButtonBase
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void pick(e.dataTransfer.files?.[0]);
              }}
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 1,
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                p: 2,
              }}
            >
              {image ? (
                <Box
                  component="img"
                  src={image}
                  alt=""
                  sx={{ maxHeight: 260, maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <>
                  <AddPhotoAlternateOutlined sx={{ fontSize: 40, color: 'text.secondary' }} />
                  <Typography variant="body2">Drop a picture here, or choose one</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    PNG, JPEG, GIF or WebP, up to 3.5 MB
                  </Typography>
                </>
              )}
            </ButtonBase>
            {imageError && <Alert severity="warning">{imageError}</Alert>}
            <TextField
              size="small"
              label="Anything the picture does not say"
              placeholder="Dark mode; lead with the green"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {propose.isError && <Alert severity="error">{propose.error.message}</Alert>}
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              {rationale && <Alert severity="info">{rationale}</Alert>}
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  label="Name"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  size="small"
                  label="Based on"
                  value={draft.baseThemeId ?? 'CLASSIC'}
                  onChange={(e) =>
                    set({ baseThemeId: e.target.value as ThemeDraft['baseThemeId'] })
                  }
                  sx={{ width: 150 }}
                >
                  {BUILT_IN_THEMES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Font"
                  value={draft.fontFamily ?? ''}
                  onChange={(e) => set({ fontFamily: e.target.value || undefined })}
                  sx={{ width: 160 }}
                />
              </Stack>
              <Typography variant="subtitle2">
                Data colors, in the order series take them
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {draft.dataColors.map((c, i) => (
                  <ColorField
                    key={i}
                    label={`${i + 1}`}
                    value={c}
                    onChange={(hex) => setDataColor(i, hex)}
                    onRemove={() => set({ dataColors: draft.dataColors.filter((_, j) => j !== i) })}
                  />
                ))}
                {draft.dataColors.length < MAX_DATA_COLORS && (
                  <Button
                    size="small"
                    onClick={() => set({ dataColors: [...draft.dataColors, '#888888'] })}
                  >
                    Add a color
                  </Button>
                )}
              </Box>
              <Typography variant="subtitle2">Interface</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {EDITABLE_ROLES.map((role) => (
                  <ColorField
                    key={role}
                    label={role.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    value={draft.uiColors?.[role] ?? ''}
                    placeholder="From the base"
                    onChange={(hex) => setRole(role, hex)}
                  />
                ))}
              </Box>
              {problems.length > 0 && <Alert severity="warning">{problems.join(' ')}</Alert>}
              {create.isError && <Alert severity="error">{create.error.message}</Alert>}
            </Stack>
            <Box sx={{ width: { md: 360 }, flexShrink: 0 }}>
              <ThemePreview draft={draft} />
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {!draft ? (
          <>
            <Button onClick={() => setDraft({ ...BLANK_DRAFT })}>Start from scratch</Button>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <ModelPill work="authoring" models={models} />
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                disabled={!image || propose.isPending}
                onClick={() => propose.mutate()}
              >
                {propose.isPending ? 'Reading the picture…' : 'Draft a theme'}
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Button
              onClick={() => {
                setDraft(null);
                setRationale(undefined);
              }}
            >
              Back
            </Button>
            <Stack direction="row" spacing={1}>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="contained"
                disabled={problems.length > 0 || create.isPending}
                onClick={() => create.mutate(draft)}
              >
                {create.isPending ? 'Creating…' : 'Create theme'}
              </Button>
            </Stack>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
