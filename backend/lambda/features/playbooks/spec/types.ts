/**
 * A playbook someone composed: inputs, what to select, and the steps to take
 * on each selected asset. Saved as data; `specPlaybook` turns it into a
 * Playbook, so it previews, gates, runs and retries like the built-ins.
 *
 * Any value may be a literal or `{{inputKey}}`, filled from the inputs given
 * when it is previewed.
 */
type Templated<T> = T | `{{${string}}}`;

export interface SpecInput {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'boolean' | 'datasource' | 'engine' | 'folder';
  help?: string;
  required?: boolean;
  default?: string | number | boolean;
}

/** What a spec can select: assets, or QuickSight users. */
export type SelectableType = 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'user';

/** A condition an asset must meet to be selected. Cheap ones read the list; lineage ones follow the graph. */
export type SpecCondition =
  /** At least this many views in the activity window the portal keeps. */
  | { kind: 'views'; min: Templated<number> }
  /** No more than this many views (unused, or barely used). */
  | { kind: 'viewsAtMost'; max: Templated<number> }
  | { kind: 'tagged'; tag: Templated<string> }
  | { kind: 'nameContains'; text: Templated<string> }
  | { kind: 'hasErrors' }
  /** Shared with a user or group whose name contains this (from the asset's permissions). */
  | { kind: 'sharedWith'; principal: Templated<string> }
  /** Reads (through its datasets) a data source of this engine: REDSHIFT, ATHENA, S3... */
  | { kind: 'readsEngine'; engine: Templated<string> }
  /** Reads a dataset a SMUS listing governs (or, with value false, one it does not). */
  | { kind: 'readsGoverned'; value: Templated<boolean> }
  /** Users: one of these roles, comma-separated (READER, READER_PRO, AUTHOR...). */
  | { kind: 'role'; roles: Templated<string> }
  /** Users: never active, or last active more than this many days ago. */
  | { kind: 'inactiveForDays'; days: Templated<number> }
  /**
   * Users: in no group and reaching no asset, directly or through a group or
   * folder. Groups and folders named here (comma-separated) do not count,
   * e.g. an everyone group or a folder shared with all readers.
   */
  | { kind: 'noAccess'; ignoreGroups?: Templated<string>; ignoreFolders?: Templated<string> };

/**
 * For each dataset the asset reads (or, for a dataset, itself), find another
 * that could take its place: of this engine, SMUS-governed if asked, and
 * holding every column the asset uses. Exact names first; with `infer`, a
 * model maps the rest using the governed columns' descriptions, and every
 * mapping it proposes is checked before it counts.
 */
export interface MatchDatasetStep {
  kind: 'matchDataset';
  engine?: Templated<string>;
  governed?: Templated<boolean>;
  infer?: Templated<boolean>;
  /** A model's mapping below this confidence (0-1) goes to review. */
  minConfidence?: Templated<number>;
}

/** Point the asset at the datasets the match step found (a rebind, checked by a dry run). */
interface RebindStep {
  kind: 'rebind';
}

/** Tag something: the asset, the datasets it read before, or their data sources. */
export interface TagStep {
  kind: 'tag';
  target: 'asset' | 'replaced-datasets' | 'replaced-datasources';
  key: Templated<string>;
  value: Templated<string>;
}

/** Fix what the repair plan can fix alone; anything needing a choice goes to review. */
interface RepairStep {
  kind: 'repair';
}

/**
 * Replace calculated fields the dataset now holds as columns (materialised
 * upstream) with those columns, and drop them. Needs a model to be sure;
 * without one, name matches are listed for review.
 */
export interface ReplaceMaterialisedStep {
  kind: 'replaceMaterialisedCalcs';
  /** Only fields over a SMUS-governed dataset (default true). */
  governed?: Templated<boolean>;
  infer?: Templated<boolean>;
  minConfidence?: Templated<number>;
  /** Prefixes to set aside when matching names, comma-separated (default "c_ds_,c_"). */
  prefixes?: Templated<string>;
}

/** Drop the calculated fields nothing reads (and those only such fields read). */
export interface DropUnusedStep {
  kind: 'dropUnusedCalcs';
}

/** Rename calculated fields to the standard: the prefix, then snake_case. */
export interface RenameToStandardStep {
  kind: 'renameCalcsToStandard';
  /** Default c_ (the analysis and dashboard prefix; datasets use c_ds_). */
  prefix?: Templated<string>;
}

/**
 * A dataset's calculated fields to the standard names, migrated so no
 * dashboard or analysis reading them breaks: copy, repoint readers, retire.
 */
export interface RenameDatasetCalcsStep {
  kind: 'renameDatasetCalcsToStandard';
  /** Default c_ds_. */
  prefix?: Templated<string>;
}

/**
 * Delete a user the selection found idle. Only readers can be deleted, and
 * only while the portal's activity covers `inactiveDays`; a reader who signs
 * in again is provisioned again by the identity provider.
 */
export interface DeleteUserStep {
  kind: 'deleteUser';
  inactiveDays: Templated<number>;
}

/** Put the asset in a folder (a shared folder then carries its audience). */
interface AddToFolderStep {
  kind: 'addToFolder';
  folder: Templated<string>;
}

export type SpecStep =
  | MatchDatasetStep
  | RebindStep
  | TagStep
  | RepairStep
  | AddToFolderStep
  | ReplaceMaterialisedStep
  | DropUnusedStep
  | RenameToStandardStep
  | RenameDatasetCalcsStep
  | DeleteUserStep;

export interface PlaybookSpec {
  id: string;
  name: string;
  description?: string;
  inputs: SpecInput[];
  /** Assets of these types; every condition must hold. */
  select: { assetTypes: SelectableType[]; where: SpecCondition[] };
  steps: SpecStep[];
  /** Which group its card sits in; people's own go under Yours. */
  category?: 'repair' | 'data' | 'cleanup' | 'custom';
  /** Gate values this playbook starts with. */
  gates?: Record<string, number | string | boolean>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlaybookSpecInput = Omit<PlaybookSpec, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;
