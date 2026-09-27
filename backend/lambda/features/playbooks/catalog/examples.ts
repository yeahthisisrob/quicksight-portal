/**
 * Playbooks the portal ships as specs: the same blocks anyone composes
 * with, so each is also a starting point to copy and change.
 */
import type { PlaybookSpec } from '../spec/types';

const SHIPPED_AT = '2026-09-26T00:00:00Z';

export const EXAMPLE_SPECS: PlaybookSpec[] = [
  {
    id: 'move-to-governed-athena',
    name: 'Move busy dashboards onto governed Athena datasets',
    description:
      'Dashboards viewed at least the number of times you set that still read Redshift: each dataset they read is matched to a SMUS-governed Athena dataset holding every column they use (a model maps names that differ, using the governed descriptions), the dashboard is rebound onto it, and the old dataset and its Redshift data source are tagged deprecated. Nothing is deleted.',
    inputs: [
      {
        key: 'minViews',
        label: 'At least this many views',
        kind: 'number',
        default: 50,
        required: true,
      },
      {
        key: 'fromEngine',
        label: 'Move off this engine',
        kind: 'engine',
        default: 'REDSHIFT',
        required: true,
      },
      {
        key: 'toEngine',
        label: 'Onto datasets of this engine',
        kind: 'engine',
        default: 'ATHENA',
        required: true,
      },
      {
        key: 'infer',
        label: 'Let a model map columns whose names differ',
        kind: 'boolean',
        default: true,
      },
    ],
    category: 'data',
    select: {
      assetTypes: ['dashboard'],
      where: [
        { kind: 'views', min: '{{minViews}}' },
        { kind: 'readsEngine', engine: '{{fromEngine}}' },
      ],
    },
    steps: [
      {
        kind: 'matchDataset',
        engine: '{{toEngine}}',
        governed: true,
        infer: '{{infer}}',
        minConfidence: 0.8,
      },
      { kind: 'rebind' },
      {
        kind: 'tag',
        target: 'replaced-datasets',
        key: 'portal:deprecated',
        value: 'moved to governed Athena',
      },
      {
        kind: 'tag',
        target: 'replaced-datasources',
        key: 'portal:deprecated',
        value: 'moved to governed Athena',
      },
    ],
    gates: { editedWithinDays: 7 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'team-into-shared-folder',
    name: "Put a team's assets in its shared folder",
    description:
      "Every dashboard, analysis, dataset and data source shared with a team (or tagged for it) goes into the team's shared folder, so the folder carries their access from now on. Anything already there is skipped; nothing is removed from anywhere.",
    inputs: [
      {
        key: 'team',
        label: 'Shared with (group or user name contains)',
        kind: 'text',
        required: true,
      },
      { key: 'folder', label: "The team's shared folder", kind: 'folder', required: true },
    ],
    category: 'cleanup',
    select: {
      assetTypes: ['dashboard', 'analysis', 'dataset', 'datasource'],
      where: [{ kind: 'sharedWith', principal: '{{team}}' }],
    },
    steps: [{ kind: 'addToFolder', folder: '{{folder}}' }],
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'use-governed-columns',
    name: 'Use governed columns instead of calculated fields',
    description:
      'Dashboards and analyses that compute something their governed dataset now holds as a column (materialised upstream): each such calculated field is replaced by the column and dropped. A model judges every one against the governed column descriptions; only confident, dry-run-checked replacements are made, and the rest are listed for review.',
    inputs: [
      {
        key: 'minConfidence',
        label: 'Replace only at this confidence or above (0-1)',
        kind: 'number',
        default: 0.85,
      },
    ],
    category: 'repair',
    select: {
      assetTypes: ['dashboard', 'analysis'],
      where: [{ kind: 'readsGoverned', value: true }],
    },
    steps: [
      {
        kind: 'replaceMaterialisedCalcs',
        governed: true,
        infer: true,
        minConfidence: '{{minConfidence}}',
      },
    ],
    gates: { editedWithinDays: 7 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'drop-unused-calcs',
    name: 'Drop calculated fields nothing reads',
    description:
      'Calculated fields no visual, filter, control, parameter or other field reads, in every dashboard and analysis (a leftover read only by other leftovers goes too). A field anything reads is never dropped, and every rewrite is dry-run first.',
    inputs: [],
    category: 'cleanup',
    select: { assetTypes: ['dashboard', 'analysis'], where: [] },
    steps: [{ kind: 'dropUnusedCalcs' }],
    gates: { editedWithinDays: 7 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'calcs-to-standard-names',
    name: 'Name calculated fields to the standard',
    description:
      'Every calculated field in dashboards and analyses gets the organisation\'s prefix and a snake_case name ("Order Margin %" becomes c_order_margin_pct), everywhere it is read. A name already in use is left for review. Bookmarks that named the old field may need saving again.',
    inputs: [{ key: 'prefix', label: 'Prefix', kind: 'text', default: 'c_', required: true }],
    category: 'cleanup',
    select: { assetTypes: ['dashboard', 'analysis'], where: [] },
    steps: [{ kind: 'renameCalcsToStandard', prefix: '{{prefix}}' }],
    gates: { editedWithinDays: 7 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'dataset-calcs-to-standard-names',
    name: 'Name dataset calculated fields to the standard',
    description:
      "A dataset's calculated fields get the organisation's dataset prefix and a snake_case name without breaking anything that reads them: each is copied under the new name, every dashboard and analysis reading the old name moves to the new one, and the old name goes once nothing reads it. On SPICE the readers move on a later run, once a refresh has loaded the new column; run it again to finish.",
    inputs: [{ key: 'prefix', label: 'Prefix', kind: 'text', default: 'c_ds_', required: true }],
    category: 'cleanup',
    select: { assetTypes: ['dataset'], where: [] },
    steps: [{ kind: 'renameDatasetCalcsToStandard', prefix: '{{prefix}}' }],
    gates: { editedWithinDays: 7 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
  {
    id: 'remove-idle-readers',
    name: 'Remove idle readers',
    description:
      'Readers who are in no group, reach no dashboard (directly, through a group or through a folder) and have not been active for the window are paid for and unused. Each is deleted with their groups and permissions archived first; with an identity provider that provisions readers on sign-in, one who comes back gets a seat again, and Restore access on the Operations archive gives them what they had. Groups and folders listed as not counting (an everyone group, a folder shared with all readers) are ignored. Nothing runs unless the portal activity covers the whole window and was refreshed in the last two days.',
    inputs: [
      { key: 'days', label: 'Inactive for (days)', kind: 'number', default: 90, required: true },
      {
        key: 'ignoreGroups',
        label: 'Groups that do not count',
        kind: 'text',
        help: 'Comma-separated group names, e.g. a group every reader is in',
      },
      {
        key: 'ignoreFolders',
        label: 'Folders that do not count',
        kind: 'text',
        help: 'Comma-separated folder names or paths',
      },
    ],
    category: 'cleanup',
    select: {
      assetTypes: ['user'],
      where: [
        { kind: 'role', roles: 'READER,READER_PRO' },
        { kind: 'inactiveForDays', days: '{{days}}' },
        { kind: 'noAccess', ignoreGroups: '{{ignoreGroups}}', ignoreFolders: '{{ignoreFolders}}' },
      ],
    },
    steps: [{ kind: 'deleteUser', inactiveDays: '{{days}}' }],
    gates: { canary: 5 },
    createdBy: 'The portal',
    createdAt: SHIPPED_AT,
    updatedAt: SHIPPED_AT,
  },
];
