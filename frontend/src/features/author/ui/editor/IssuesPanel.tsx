/**
 * Issues - what is wrong with the open asset, and the fixes. Definition
 * errors first: everything that stops QuickSight from writing it, each with
 * the fix the server proposes; accept it, swap it for an alternative, or
 * leave it, and "Fix all" takes every proposal. A dataset that cannot be read
 * needs one chosen here; the plan re-runs against it so its columns are
 * checked too. Then the visuals that load slowly or fail, from CloudWatch;
 * a click selects one on the canvas.
 */
import { AutoFixHigh, Close } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  ButtonBase,
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

import type {
  ColumnUsage,
  RepairFix,
  RepairIssue,
  VisualHealth,
} from '@/shared/api/modules/authoring';

import { isSlow, problemVisuals, seconds } from '../../lib/insights';
import { findOutlineElement, outlineFromModel } from '../../lib/ops';
import {
  chosenFix,
  describeFix,
  fixOptions,
  REPAIR_KIND_LABELS,
  REPAIR_KIND_ORDER,
  sameFix,
} from '../../model/repair';
import type { Studio } from '../../model/useStudio';
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

function IssueRow({ issue, studio }: { issue: RepairIssue; studio: Studio }) {
  const { repair, draft } = studio;
  const options = fixOptions(issue);
  const current = chosenFix(issue, repair.choices);
  const selectValue = current ? String(options.findIndex((o) => sameFix(o, current))) : LEAVE;
  const target = issue.identifier ? (draft.targets[issue.identifier] ?? null) : null;
  const usage = usageWords(issue.usage);

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack spacing={1.25}>
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

        <Box sx={{ width: '100%' }}>
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

/** Slow or failing visuals, by title where the definition gives one. */
function HealthRows({ studio }: { studio: Studio }) {
  const problems = problemVisuals(studio.insights.data);
  const outline = studio.source.model ? outlineFromModel(studio.source.model) : null;
  if (problems.length === 0) {
    return null;
  }
  const label = (v: VisualHealth) =>
    findOutlineElement(outline, v.sheetId, v.visualId)?.element.title || v.visualId;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Slow or failing visuals{' '}
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
          {problems.length}
        </Typography>
      </Typography>
      <Divider />
      {problems.map((v) => (
        <ButtonBase
          key={`${v.sheetId}/${v.visualId}`}
          onClick={() => studio.selectElement({ sheetId: v.sheetId, elementId: v.visualId })}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            gap: 1,
            py: 1,
            px: 0.5,
            borderRadius: 1,
            textAlign: 'left',
          }}
        >
          <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
            {label(v)}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            {isSlow(v) && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={`p90 ${seconds(v.loadTimeP90Ms ?? 0)}`}
              />
            )}
            {(v.errors ?? 0) > 0 && (
              <Chip size="small" color="error" variant="outlined" label={`${v.errors} errors`} />
            )}
          </Stack>
        </ButtonBase>
      ))}
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
        From CloudWatch over {studio.insights.data?.health?.windowDays ?? 0} days. Retype, move or
        remove them on the canvas.
      </Typography>
    </Box>
  );
}

export function IssuesPanel({ studio }: { studio: Studio }) {
  const { repair } = studio;
  const plan = repair.plan;
  const issues = plan?.issues ?? [];
  const { summary } = repair;

  if (repair.loading && !plan) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const groups = REPAIR_KIND_ORDER.map((kind) => ({
    kind,
    issues: issues.filter((i) => i.kind === kind),
  })).filter((g) => g.issues.length > 0);
  const hasHealthProblems = problemVisuals(studio.insights.data).length > 0;

  return (
    <Stack spacing={2.5} data-testid="issues-panel">
      {repair.error && <Alert severity="error">{repair.error}</Alert>}
      {issues.length === 0 && !repair.error && (
        <Alert severity="success">
          <AlertTitle>No definition errors</AlertTitle>
          The definition checks out against its datasets and QuickSight reports no errors.
        </Alert>
      )}
      {issues.length > 0 && (
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            {repair.loading && <StatusIndicator kind="loading">Checking</StatusIndicator>}
            {summary.needsChoice > 0 ? (
              <StatusIndicator kind="warning">
                {summary.needsChoice} dataset{summary.needsChoice === 1 ? '' : 's'} to choose
              </StatusIndicator>
            ) : (
              <StatusIndicator kind={summary.accepted === summary.total ? 'success' : 'info'}>
                {summary.accepted} of {summary.total} fixed
              </StatusIndicator>
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant="contained"
              startIcon={<AutoFixHigh />}
              onClick={repair.acceptAll}
              disabled={(plan?.summary.fixable ?? 0) === 0}
            >
              Fix all
            </Button>
          </Stack>
          {plan && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {plan.summary.fixable} fixable, {plan.summary.needsChoice} need a dataset,{' '}
              {plan.summary.unfixable} cannot be fixed here. Fixes show on the canvas and are
              written when you save.
            </Typography>
          )}
        </Stack>
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
            <IssueRow key={issue.id} issue={issue} studio={studio} />
          ))}
        </Box>
      ))}
      <HealthRows studio={studio} />
      {!hasHealthProblems && studio.insights.data?.health && (
        <StatusIndicator kind="success">Every visual loads cleanly</StatusIndicator>
      )}
    </Stack>
  );
}
