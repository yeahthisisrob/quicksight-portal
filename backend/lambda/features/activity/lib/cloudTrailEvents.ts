/**
 * CloudTrail event knowledge for the activity slice: which QuickSight event
 * names count as views / mutations per asset type, how to pull the asset id
 * and actor out of a raw event, and how an event name maps to an action
 * category. Pure functions and frozen config - no I/O - so ActivityService
 * stays about orchestration and the cache.
 */

import type { AssetType } from '../../../shared/types/assetTypes';
import type { ActionCategory } from '../types';

/**
 * Asset type configurations for event processing
 */
export const ASSET_EVENT_CONFIG = {
  dashboard: {
    events: ['GetDashboard', 'GetDashboardEmbedUrl'],
    extractId: (event: any) => {
      const id =
        event.requestParameters?.dashboardId ||
        event.serviceEventDetails?.eventRequestDetails?.dashboardId ||
        event.serviceEventDetails?.dashboardId ||
        event.serviceEventDetails?.eventRequestDetails?.DashboardId ||
        event.requestParameters?.DashboardId;
      return id ? id.split('/').pop() : null;
    },
  },
  analysis: {
    events: ['GetAnalysis'],
    extractId: (event: any) => {
      const id =
        event.requestParameters?.analysisId ||
        event.serviceEventDetails?.eventRequestDetails?.analysisId ||
        event.serviceEventDetails?.analysisId ||
        event.serviceEventDetails?.eventRequestDetails?.AnalysisId ||
        event.requestParameters?.AnalysisId;
      return id ? id.split('/').pop() : null;
    },
  },
} as const;

/**
 * Shared extractor: walk a CloudTrail event JSON for a requestParameters field
 * under several common shapes (camelCase, PascalCase, nested serviceEventDetails).
 * Returns the last URI segment (e.g. 'abc-123' from 'arn:.../dashboard/abc-123').
 */
/** Return `candidate` if it's a non-empty string, else undefined. */
function nonEmptyString(candidate: unknown): string | undefined {
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

/**
 * CloudTrail embeds view-event asset names inside
 * `serviceEventDetails.eventResponseDetails.<type>Details.<type>Name`.
 */
function extractViewEventName(event: any): string | undefined {
  const details = event.serviceEventDetails?.eventResponseDetails;
  if (!details) {
    return undefined;
  }
  return (
    nonEmptyString(details.dashboardDetails?.dashboardName) ||
    nonEmptyString(details.analysisDetails?.analysisName) ||
    nonEmptyString(details.dataSetDetails?.dataSetName) ||
    nonEmptyString(details.dataSourceDetails?.dataSourceName) ||
    nonEmptyString(details.folderDetails?.folderName)
  );
}

/**
 * Best-effort asset-name extraction from a CloudTrail event. CloudTrail embeds
 * names in several places depending on whether the event is a view or mutation:
 *
 *   Views (Get/Describe): serviceEventDetails.eventResponseDetails.<type>Details.<type>Name
 *   Create/Update mutations: requestParameters.name (when the name was set/changed)
 *   Any mutation: responseElements.name (fallback)
 *
 * Returns undefined when none of these are present (e.g. Delete/permission
 * events) — callers then fall back to catalog hydration.
 */
/**
 * Keys worth keeping from mutation payloads: identifiers, names, ARNs, and
 * error/status fields. Everything else (definitions, sheets, TLS/user-agent
 * noise) is dropped — views stay minimal for volume, mutations keep just
 * enough to debug and to hydrate names without a catalog lookup.
 */
const MUTATION_DETAIL_KEY_PATTERN = /(id|name|arn|alias|status|version|error)/i;
const MUTATION_DETAIL_MAX_CHARS = 4096;

/** Shallow-filter an object to allowlisted scalar entries. */
function allowlistScalars(obj: any): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isScalar =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    if (isScalar && MUTATION_DETAIL_KEY_PATTERN.test(key)) {
      kept[key] = value;
    }
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/**
 * Capture an allowlisted slice of a mutation event's CloudTrail payload for
 * storage on MinimalEvent.d — request/response identifiers and names, the
 * console eventRequestDetails array, and error fields. Size-capped; drops the
 * bulkiest sections first when over the cap.
 */
export function captureMutationDetails(event: any): Record<string, unknown> | undefined {
  const details: Record<string, unknown> = {};

  const request = allowlistScalars(event.requestParameters);
  if (request) {
    details.requestParameters = request;
  }
  const response = allowlistScalars(event.responseElements);
  if (response) {
    details.responseElements = response;
  }
  const eventRequestDetails = event.serviceEventDetails?.eventRequestDetails;
  if (eventRequestDetails !== undefined && eventRequestDetails !== null) {
    details.eventRequestDetails = eventRequestDetails;
  }
  if (event.errorCode) {
    details.errorCode = event.errorCode;
  }
  if (event.errorMessage) {
    details.errorMessage = event.errorMessage;
  }

  if (Object.keys(details).length === 0) {
    return undefined;
  }

  // Cap stored size — drop the console details array (the only unbounded
  // section) if the capture is oversized, and mark the truncation.
  if (JSON.stringify(details).length > MUTATION_DETAIL_MAX_CHARS) {
    delete details.eventRequestDetails;
    details.truncated = true;
  }

  return details;
}

/**
 * CloudTrail sometimes delivers `serviceEventDetails.eventRequestDetails` as
 * a JSON-encoded STRING instead of the object/array shapes — which silently
 * defeats every keyed lookup. Parse it in place (idempotent, best-effort) so
 * extraction and the details capture see structured data.
 */
export function normalizeServiceEventDetails(event: any): void {
  const details = event?.serviceEventDetails?.eventRequestDetails;
  if (typeof details !== 'string') {
    return;
  }
  try {
    event.serviceEventDetails.eventRequestDetails = JSON.parse(details);
  } catch {
    // leave the string in place — the ARN scan below still works on it
  }
}

/**
 * Last-resort id extraction: scan the event payload for a QuickSight ARN of
 * the expected asset type (`...:analysis/<id>`), regardless of how the
 * payload is shaped or nested. Shape drift in console service events has
 * repeatedly broken keyed extraction; ARNs survive every variant.
 */
export function extractIdFromArnScan(event: any, assetType: string): string | null {
  const haystack = JSON.stringify({
    requestParameters: event?.requestParameters,
    responseElements: event?.responseElements,
    serviceEventDetails: event?.serviceEventDetails,
    resources: event?.resources ?? event?.Resources,
  });
  const pattern = new RegExp(`arn:[^"]*quicksight[^"]*:${assetType}/([A-Za-z0-9-]+)`);
  const match = haystack.match(pattern);
  return match?.[1] ?? null;
}

export function extractEventName(event: any): string | undefined {
  return (
    extractViewEventName(event) ||
    nonEmptyString(event.requestParameters?.name) ||
    nonEmptyString(event.requestParameters?.Name) ||
    nonEmptyString(event.responseElements?.name) ||
    nonEmptyString(event.responseElements?.Name) ||
    extractDetailsArrayName(event)
  );
}

/**
 * Console mutation events carry sub-action entries in the eventRequestDetails
 * ARRAY shape (e.g. renameAnalysis). Scan entry values for an asset-level name;
 * deliberately ignores nested names like sheetName/visualName.
 * Payload shape documented on fromEventDetailsArray below.
 */
function extractDetailsArrayName(event: any): string | undefined {
  const details = event.serviceEventDetails?.eventRequestDetails;
  if (!Array.isArray(details)) {
    return undefined;
  }
  for (const entry of details) {
    const value = entry?.value;
    if (value && typeof value === 'object') {
      const name =
        nonEmptyString(value.analysisName) ||
        nonEmptyString(value.dashboardName) ||
        nonEmptyString(value.name);
      if (name) {
        return name;
      }
    }
  }
  return undefined;
}

/**
 * Console-originated mutation events (eventType AwsServiceEvent, e.g.
 * UpdateAnalysis) record `serviceEventDetails.eventRequestDetails` as an
 * ARRAY of {key, value} pairs instead of a flat object — API-originated
 * events use the flat-object shape. Returns the value for `key` when the
 * array shape is present, else undefined.
 *
 * Example (captured from a real console UpdateAnalysis event):
 *   "requestParameters": null,
 *   "serviceEventDetails": {
 *     "eventRequestDetails": [
 *       { "key": "addSheet",   "value": { "sheetId": "arn:...:sheet/x", "sheetName": "Sheet 2" } },
 *       { "key": "analysisId", "value": "arn:aws:quicksight:...:analysis/<id>" }
 *     ]
 *   }
 *
 * Non-API event list (UpdateAnalysis & sub-actions are console service events):
 *   https://docs.aws.amazon.com/quicksuite/latest/userguide/incident-response-logging-and-monitoring-qs.html#logging-non-api
 * Real payload example:
 *   https://github.com/aws-samples/siem-on-amazon-opensearch-service/issues/33
 */
function fromEventDetailsArray(event: any, key: string): unknown {
  const details = event.serviceEventDetails?.eventRequestDetails;
  if (!Array.isArray(details)) {
    return undefined;
  }
  return details.find((entry: any) => entry?.key === key)?.value;
}

export const extractParam = (event: any, ...keys: string[]): string | null => {
  for (const key of keys) {
    const v =
      event.requestParameters?.[key] ||
      event.serviceEventDetails?.eventRequestDetails?.[key] ||
      event.serviceEventDetails?.[key] ||
      nonEmptyString(fromEventDetailsArray(event, key));
    if (v) {
      const tail = String(v).split('/').pop();
      if (tail) {
        return tail;
      }
    }
  }
  // Fall back to the first QuickSight ARN in Resources[]
  const arn: string | undefined = event.resources?.[0]?.ARN ?? event.Resources?.[0]?.ARN;
  if (arn) {
    const match = arn.match(/\/([^/]+)$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

/**
 * Mutation event configuration — one entry per QuickSight catalog asset type
 * (the 7 types the portal tracks in its catalog: dashboard, analysis, dataset,
 * datasource, folder, group, user) with the event names to track and a
 * per-asset-type id extractor. Used by the activity timeline to ingest
 * CloudTrail mutation events into the shared ActivityCache.
 *
 * Events for QuickSight resources NOT in the catalog (templates, themes,
 * brands, topics, action connectors, VPC connections, namespaces) and
 * account-level settings mutations are captured separately via
 * OTHER_MUTATION_EVENTS below.
 */
export const ASSET_MUTATION_CONFIG: Record<
  Exclude<AssetType, never>,
  { events: readonly string[]; extractId: (event: any) => string | null }
> = {
  dashboard: {
    events: [
      'CreateDashboard',
      'UpdateDashboard',
      'UpdateDashboardLinks',
      'UpdateDashboardPermissions',
      'UpdateDashboardPublishedVersion',
      'DeleteDashboard',
    ],
    extractId: (event) => extractParam(event, 'dashboardId', 'DashboardId'),
  },
  analysis: {
    events: [
      'CreateAnalysis',
      'UpdateAnalysis',
      'UpdateAnalysisPermissions',
      'DeleteAnalysis',
      'RestoreAnalysis',
    ],
    extractId: (event) => extractParam(event, 'analysisId', 'AnalysisId'),
  },
  dataset: {
    events: [
      'CreateDataSet',
      'UpdateDataSet',
      'UpdateDataSetPermissions',
      'DeleteDataSet',
      'PutDataSetRefreshProperties',
      'DeleteDataSetRefreshProperties',
      'CreateRefreshSchedule',
      'UpdateRefreshSchedule',
      'DeleteRefreshSchedule',
      'CreateIngestion',
      'CancelIngestion',
    ],
    extractId: (event) => extractParam(event, 'dataSetId', 'DataSetId'),
  },
  datasource: {
    events: [
      'CreateDataSource',
      'UpdateDataSource',
      'UpdateDataSourcePermissions',
      'DeleteDataSource',
    ],
    extractId: (event) => extractParam(event, 'dataSourceId', 'DataSourceId'),
  },
  folder: {
    events: [
      'CreateFolder',
      'UpdateFolder',
      'UpdateFolderPermissions',
      'DeleteFolder',
      'CreateFolderMembership',
      'DeleteFolderMembership',
    ],
    extractId: (event) => extractParam(event, 'folderId', 'FolderId'),
  },
  group: {
    events: [
      'CreateGroup',
      'UpdateGroup',
      'DeleteGroup',
      'CreateGroupMembership',
      'DeleteGroupMembership',
    ],
    extractId: (event) => extractParam(event, 'groupName', 'GroupName'),
  },
  user: {
    events: [
      'RegisterUser',
      'UpdateUser',
      'DeleteUser',
      'DeleteUserByPrincipalId',
      'UpdateUserCustomPermission',
      'DeleteUserCustomPermission',
    ],
    extractId: (event) => extractParam(event, 'userName', 'UserName'),
  },
} as const;

/**
 * Mutation events on QuickSight resources the portal's catalog doesn't track
 * (templates, themes, brands, topics, action connectors, VPC connections,
 * namespaces) plus account-level / global settings mutations. These land in
 * the timeline with `at: 'other'` and don't attempt asset-id extraction —
 * the UI shows the raw event name and user.
 *
 * Reads (Describe/List/Search/Get) and embed-URL generators are intentionally
 * excluded — the timeline only records "touching" events.
 */
const OTHER_MUTATION_EVENTS: readonly string[] = [
  // Templates
  'CreateTemplate',
  'UpdateTemplate',
  'DeleteTemplate',
  'CreateTemplateAlias',
  'UpdateTemplateAlias',
  'DeleteTemplateAlias',
  'UpdateTemplatePermissions',

  // Themes
  'CreateTheme',
  'UpdateTheme',
  'DeleteTheme',
  'CreateThemeAlias',
  'DeleteThemeAlias',
  'UpdateThemePermissions',

  // Brands
  'CreateBrand',
  'UpdateBrand',
  'UpdateBrandPublishedVersion',
  'DeleteBrand',
  'UpdateBrandAssignment',
  'DeleteBrandAssignment',

  // Topics (QuickSight Q)
  'CreateTopic',
  'UpdateTopic',
  'UpdateTopicPermissions',
  'DeleteTopic',
  'CreateTopicRefreshSchedule',
  'UpdateTopicRefreshSchedule',
  'DeleteTopicRefreshSchedule',
  'BatchCreateTopicReviewedAnswer',
  'BatchDeleteTopicReviewedAnswer',

  // Action Connectors
  'CreateActionConnector',
  'UpdateActionConnector',
  'UpdateActionConnectorPermissions',
  'DeleteActionConnector',

  // VPC Connections
  'CreateVPCConnection',
  'UpdateVPCConnection',
  'DeleteVPCConnection',

  // Namespaces
  'CreateNamespace',
  'DeleteNamespace',

  // Account / global settings
  'CreateAccountCustomization',
  'UpdateAccountCustomization',
  'DeleteAccountCustomization',
  'CreateAccountSubscription',
  'DeleteAccountSubscription',
  'UpdateAccountSettings',
  'UpdateAccountCustomPermission',
  'DeleteAccountCustomPermission',
  'CreateCustomPermissions',
  'UpdateCustomPermissions',
  'DeleteCustomPermissions',
  'UpdateRoleCustomPermission',
  'DeleteRoleCustomPermission',
  'CreateRoleMembership',
  'DeleteRoleMembership',
  'CreateIAMPolicyAssignment',
  'UpdateIAMPolicyAssignment',
  'DeleteIAMPolicyAssignment',
  'UpdateIpRestriction',
  'UpdateKeyRegistration',
  'UpdatePublicSharingSettings',
  'UpdateIdentityPropagationConfig',
  'DeleteIdentityPropagationConfig',
  'UpdateDefaultQBusinessApplication',
  'DeleteDefaultQBusinessApplication',
  'UpdateQPersonalizationConfiguration',
  'UpdateQuickSightQSearchConfiguration',
  'UpdateSelfUpgrade',
  'UpdateSelfUpgradeConfiguration',
  'UpdateSPICECapacityConfiguration',
  'UpdateDashboardsQAConfiguration',

  // Tagging (operates on any taggable resource — resource ARN is in the event)
  'TagResource',
  'UntagResource',

  // Long-running jobs (user-initiated)
  'StartAssetBundleExportJob',
  'StartAssetBundleImportJob',
  'StartAutomationJob',
  'StartDashboardSnapshotJob',
  'StartDashboardSnapshotJobSchedule',
] as const;

/** Flat list of every mutation event name we care about, across all resource types. */
export const ALL_MUTATION_EVENT_NAMES: readonly string[] = [
  ...Object.values(ASSET_MUTATION_CONFIG).flatMap((cfg) => cfg.events),
  ...OTHER_MUTATION_EVENTS,
];

/** Reverse map: event name → catalog asset type. Events not in the map are 'other'. */
export const MUTATION_EVENT_TO_ASSET_TYPE: Readonly<Record<string, AssetType>> = Object.freeze(
  Object.entries(ASSET_MUTATION_CONFIG).reduce<Record<string, AssetType>>(
    (acc, [assetType, cfg]) => {
      for (const eventName of cfg.events) {
        acc[eventName] = assetType as AssetType;
      }
      return acc;
    },
    {}
  )
);

/**
 * Hard-coded per-event overrides for cases where the prefix rule would give
 * the wrong answer. Checked first inside classifyAction().
 */
const ACTION_OVERRIDES: Readonly<Record<string, ActionCategory>> = Object.freeze({
  UpdateDashboardPublishedVersion: 'publish',
  UpdateBrandPublishedVersion: 'publish',
  TagResource: 'tag',
  UntagResource: 'tag',
  RestoreAnalysis: 'update',
  RegisterUser: 'create',
  CreateIngestion: 'create',
  CancelIngestion: 'delete',
});

/**
 * Classify a CloudTrail event name into a coarse action category for timeline
 * filtering. Returns undefined for view events (Get, Describe, List, Search) —
 * callers should only pass mutation event names.
 *
 * Lookup order: explicit overrides → suffix rules (Permissions, Membership) →
 * prefix rules (Batch, Start, Create/Update/Put/Delete). The specific-first
 * order ensures UpdateDashboardPermissions matches 'grant' not 'update'.
 */
export function classifyAction(eventName: string): ActionCategory | undefined {
  const override = ACTION_OVERRIDES[eventName];
  if (override) {
    return override;
  }
  if (eventName.endsWith('Permissions')) {
    return eventName.startsWith('Delete') ? 'revoke' : 'grant';
  }
  if (eventName.endsWith('Membership')) {
    return 'member';
  }
  if (eventName.startsWith('Batch')) {
    return 'batch';
  }
  if (eventName.startsWith('Start')) {
    return 'job';
  }
  if (eventName.startsWith('Create')) {
    return 'create';
  }
  if (eventName.startsWith('Update') || eventName.startsWith('Put')) {
    return 'update';
  }
  if (eventName.startsWith('Delete')) {
    return 'delete';
  }
  return undefined;
}
