/**
 * From nothing, the last step - name it, say who reads it, pick a folder,
 * create it. A summary of everything the server will build sits above, and
 * the result card takes over once it exists.
 */
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import type { AuthorableAssetType } from '@/shared/api/modules/authoring';

import { describeVisual, isComplete } from '../../model/newAsset';
import { describeParts, describeTypeRules } from '../../model/standard';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { AudiencePicker } from '../AudiencePicker';
import { ChangesList } from '../ChangesList';
import { FolderPicker } from '../FolderPicker';
import { KeyValueList } from '../primitives/KeyValue';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';
import { ResultPanel } from './PublishStep';

const FIELD_WIDTH = 480;

export function NewPublishStep({ flow }: { flow: AuthorFlow }) {
  const { fresh, state, preview } = flow;

  if (state.result) {
    return <ResultPanel flow={flow} />;
  }

  const noun = fresh.assetType === 'dashboard' ? 'dashboard' : 'analysis';
  const visuals = fresh.visuals.filter(isComplete);
  const named = fresh.name.trim().length > 0;
  const canCreate = named && fresh.ready && !preview.error;
  const audienceFallback = flow.standard.template
    ? `Without one, the readers of "${flow.standard.template.name}" (the template)`
    : 'Without one, only you can open it until permissions are granted';

  return (
    <Stack spacing={2.5}>
      <Panel
        title="Publish"
        description={`Create a new ${noun} from the mockup.`}
        actions={
          canCreate ? (
            <StatusIndicator kind="success">Ready</StatusIndicator>
          ) : (
            <StatusIndicator kind="warning">{named ? 'Not ready' : 'Needs a name'}</StatusIndicator>
          )
        }
      >
        <Stack spacing={2.5}>
          <Stack spacing={2} sx={{ maxWidth: FIELD_WIDTH }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={fresh.assetType}
              onChange={(_, next: AuthorableAssetType | null) => next && fresh.setAssetType(next)}
              disabled={flow.publishing}
              aria-label="What to create"
            >
              <ToggleButton value="dashboard">Dashboard</ToggleButton>
              <ToggleButton value="analysis">Analysis</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              size="small"
              label="Name"
              value={fresh.name}
              onChange={(e) => fresh.setName(e.target.value)}
              disabled={flow.publishing}
              required
              slotProps={{ htmlInput: { 'data-testid': 'fresh-name' } }}
            />
            <TextField
              size="small"
              label="Sheet name"
              value={fresh.sheetName}
              onChange={(e) => fresh.setSheetName(e.target.value)}
              disabled={flow.publishing}
              helperText="Blank for the default (or the template's sheet name when one is chosen)"
            />
            <AudiencePicker
              value={fresh.audience}
              onChange={fresh.setAudience}
              disabled={flow.publishing}
              fallback={audienceFallback}
            />
            <FolderPicker
              value={state.folder}
              onChange={flow.setFolder}
              disabled={flow.publishing}
            />
          </Stack>

          <KeyValueList
            columns={4}
            items={[
              { label: 'Kind', value: fresh.assetType === 'dashboard' ? 'Dashboard' : 'Analysis' },
              {
                label: 'Datasets',
                value: fresh.datasets.map((d) => `${d.identifier} → ${d.name}`).join(', '),
              },
              {
                label: 'Visuals',
                value: `${visuals.length}: ${visuals.map((v) => `${v.title.trim()} (${v.type})`).join(', ')}`,
              },
              {
                label: 'Calculated fields added',
                value:
                  flow.addedFields.length === 0
                    ? 'None'
                    : flow.addedFields.map((f) => `${f.name} (${f.identifier})`).join(', '),
              },
              {
                label: 'Standard',
                value: flow.standard.template
                  ? `${flow.standard.template.name} (${describeParts(flow.standard.template.parts)})`
                  : 'None (builder layout)',
              },
              { label: 'Type rules', value: describeTypeRules(flow.standard.typeRules) },
              {
                label: 'Audience',
                value: fresh.audience
                  ? fresh.audience.name
                  : flow.standard.template
                    ? `From the template`
                    : 'Author only',
              },
              {
                label: 'Folder',
                value: state.folder ? (state.folder.path ?? state.folder.name) : 'Root (no folder)',
              },
            ]}
          />

          {preview.warnings.length > 0 && (
            <Alert severity="warning">
              <AlertTitle>Built with warnings</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </Box>
            </Alert>
          )}

          {flow.publishError && (
            <Alert severity="error">
              <AlertTitle>QuickSight rejected the new {noun}</AlertTitle>
              {flow.publishError}
            </Alert>
          )}

          {!fresh.ready && (
            <Alert severity="warning">
              No visual is complete. Go back to the Visuals step and give each one a title and a
              value column.
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={flow.back} disabled={flow.publishing}>
              Back
            </Button>
            <Button
              variant="contained"
              disabled={!canCreate || flow.publishing}
              startIcon={
                flow.publishing ? <CircularProgress size={16} color="inherit" /> : undefined
              }
              onClick={() => void flow.publish()}
              data-testid="create-new"
            >
              Create {noun}
            </Button>
          </Stack>
        </Stack>
      </Panel>

      <Panel
        title="What gets built"
        description="Every visual, in plain language, plus the standard."
      >
        {visuals.length > 0 && (
          <Box component="ul" sx={{ m: 0, mb: preview.changes.length > 0 ? 2 : 0, pl: 2.5 }}>
            {visuals.map((v) => (
              <li key={v.id}>{describeVisual(v)}</li>
            ))}
          </Box>
        )}
        <ChangesList
          changes={preview.changes}
          emptyText={
            preview.loading
              ? 'Working out the changes…'
              : 'Open the mockup step to see what the server builds.'
          }
        />
      </Panel>
    </Stack>
  );
}
