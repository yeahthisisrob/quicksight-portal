/**
 * Repair - everything that stops QuickSight from writing this definition,
 * each with the fix the server proposes. Accept, swap for an alternative, or
 * leave it. A dataset that cannot be read needs a target chosen here; the
 * plan re-runs against it so its columns are checked too.
 */
import { Close } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';

import { TargetDatasetPicker } from '@/entities/definition';

import type { ColumnUsage, RepairFix, RepairIssue } from '@/shared/api/modules/authoring';

import {
  chosenFix,
  describeFix,
  fixOptions,
  REPAIR_KIND_LABELS,
  REPAIR_KIND_ORDER,
  sameFix,
} from '../../model/repair';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

const LEAVE = '__leave__';

/** "3 visuals, 1 filter" from a usage record. */
function usageWords(usage: ColumnUsage | undefined): string {
  if (!usage) {
    return '';
  }
  const parts: string[] = [];
  const add = (n: number, one: string, many = `${one}s`) => {
    if (n > 0) {
      parts.push(`${n} ${n === 1 ? one : many}`);
    }
  };
  add(usage.visual, 'visual');
  add(usage.filter, 'filter');
  add(usage.calculatedField, 'calculated field');
  add(usage.parameter, 'parameter default');
  add(usage.control, 'control');
  add(usage.other, 'other reference');
  return parts.join(', ');
}

function IssueRow({ issue, flow }: { issue: RepairIssue; flow: AuthorFlow }) {
  const { repair, draft } = flow;
  const options = fixOptions(issue);
  const current = chosenFix(issue, repair.choices);
  const selectValue = current ? String(options.findIndex((o) => sameFix(o, current))) : LEAVE;
  const target = issue.identifier ? (draft.targets[issue.identifier] ?? null) : null;
  const usage = usageWords(issue.usage);

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'flex-start' } }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              size="small"
              color={issue.severity === 'error' ? 'error' : 'warning'}
              variant="outlined"
              label={issue.severity}
            />
            {issue.identifier && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {issue.identifier}
                {issue.columnName ? `.${issue.columnName}` : ''}
              </Typography>
            )}
            {issue.parameterName && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                ${'{'}
                {issue.parameterName}
                {'}'}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {issue.message}
          </Typography>
          {usage && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Used by {usage}
            </Typography>
          )}
          {issue.quickSight && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              QuickSight: {issue.quickSight.type}
              {issue.quickSight.message ? ` - ${issue.quickSight.message}` : ''}
              {issue.quickSight.paths.length > 0 ? ` (${issue.quickSight.paths.join(', ')})` : ''}
            </Typography>
          )}
        </Box>

        <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
          {issue.kind === 'dataset-missing' && issue.identifier ? (
            target ? (
              <Chip
                color="primary"
                label={`Will read ${target.name}`}
                onDelete={() => draft.setTarget(issue.identifier!, null)}
                deleteIcon={<Close />}
              />
            ) : (
              <TargetDatasetPicker
                value={target}
                onChange={(next) => draft.setTarget(issue.identifier!, next)}
                currentId={issue.dataSetId ?? ''}
              />
            )
          ) : options.length > 0 ? (
            <FormControl size="small" fullWidth>
              <InputLabel id={`fix-${issue.id}`}>Fix</InputLabel>
              <Select
                labelId={`fix-${issue.id}`}
                label="Fix"
                value={selectValue}
                onChange={(e) => {
                  const value = String(e.target.value);
                  repair.choose(
                    issue.id,
                    value === LEAVE ? null : (options[Number(value)] ?? null)
                  );
                }}
              >
                {options.map((fix: RepairFix, index) => (
                  <MenuItem key={`${fix.op}-${index}`} value={String(index)}>
                    {describeFix(fix)}
                    {index === 0 && issue.fix ? ' (proposed)' : ''}
                  </MenuItem>
                ))}
                <MenuItem value={LEAVE}>Leave as is</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <StatusIndicator kind="pending">Nothing to fix here</StatusIndicator>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export function RepairStep({ flow }: { flow: AuthorFlow }) {
  const { repair } = flow;
  const plan = repair.plan;
  const issues = plan?.issues ?? [];
  const { summary } = repair;
  const fixable = summary.accepted;

  if (repair.loading && !plan) {
    return (
      <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (repair.error) {
    return <Alert severity="error">{repair.error}</Alert>;
  }

  const groups = REPAIR_KIND_ORDER.map((kind) => ({
    kind,
    issues: issues.filter((i) => i.kind === kind),
  })).filter((g) => g.issues.length > 0);

  return (
    <Panel
      title="Repair"
      description="QuickSight refuses to write a definition with these problems. Each has a fix; accept it, pick another, or leave it and deal with it in QuickSight."
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {repair.loading && <StatusIndicator kind="loading">Checking</StatusIndicator>}
          {summary.needsChoice > 0 ? (
            <StatusIndicator kind="warning">
              {summary.needsChoice} dataset{summary.needsChoice === 1 ? '' : 's'} to choose
            </StatusIndicator>
          ) : (
            <StatusIndicator kind="success">
              {fixable} of {summary.total} fixed
            </StatusIndicator>
          )}
          <Button size="small" onClick={repair.acceptAll}>
            Accept all proposed
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2.5}>
        {issues.length === 0 && (
          <Alert severity="success">
            <AlertTitle>Nothing to repair</AlertTitle>
            The definition checks out against its datasets and QuickSight reports no errors.
          </Alert>
        )}
        {plan && issues.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {plan.summary.fixable} fixable, {plan.summary.needsChoice} need a dataset,{' '}
            {plan.summary.unfixable} cannot be fixed here. Renames and removals apply before the
            datasets step, so what you choose next is checked against the repaired definition.
          </Typography>
        )}
        {groups.map((group) => (
          <Box key={group.kind}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {REPAIR_KIND_LABELS[group.kind]}{' '}
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                {group.issues.length}
              </Typography>
            </Typography>
            <Divider />
            {group.issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} flow={flow} />
            ))}
          </Box>
        ))}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={flow.back}>Back</Button>
          <Button variant="contained" onClick={flow.next} disabled={summary.needsChoice > 0}>
            Continue
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
