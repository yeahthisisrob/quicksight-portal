/**
 * What a pass was refused, grouped by what is missing. A deployment that
 * has not finished its grants gets one refusal per table, all for the same
 * reason; shown as rows that is a wall of red that hides the one thing to
 * do. Each group names the reason, the tables it stopped and the fix.
 */
import type { MetadataSyncReport } from '@/shared/api/modules/metadataSync';

type RefusalKind = 'iam' | 'lake-formation' | 'smus-seat' | 'other';

export interface RefusalGroup {
  kind: RefusalKind;
  title: string;
  /** What to do, in a sentence. */
  fix: string;
  /** The command that does it, when there is one. */
  command?: string;
  /** The tables it stopped, as database.table, each once. */
  tables: string[];
  /** One refusal as AWS worded it. */
  example: string;
}

const IAM_ACTION = /not authorized to perform:?\s*([a-z0-9-]+:[A-Za-z]+)/i;

function kindOf(error: string, place: 'glue' | 'smus'): RefusalKind {
  if (/lake\s?formation/i.test(error)) return 'lake-formation';
  if (IAM_ACTION.test(error) || /identity-based policy/i.test(error)) return 'iam';
  if (place === 'smus' && /denied|not permitted|unauthori[sz]ed|forbidden/i.test(error)) {
    return 'smus-seat';
  }
  return 'other';
}

const ORDER: RefusalKind[] = ['iam', 'lake-formation', 'smus-seat', 'other'];

export function groupRefusals(report: MetadataSyncReport): RefusalGroup[] {
  const found = new Map<
    RefusalKind,
    { tables: Set<string>; databases: Set<string>; example: string }
  >();
  for (const table of report.tables) {
    for (const side of table.sides) {
      if (side.outcome !== 'failed' || !side.error) continue;
      const kind = kindOf(side.error, side.kind);
      const group = found.get(kind) ?? {
        tables: new Set<string>(),
        databases: new Set<string>(),
        example: side.error,
      };
      group.tables.add(`${table.database}.${table.table}`);
      group.databases.add(table.database);
      found.set(kind, group);
    }
  }
  return ORDER.flatMap((kind) => {
    const group = found.get(kind);
    if (!group) return [];
    const base = { kind, tables: [...group.tables].sort(), example: group.example };
    if (kind === 'iam') {
      const action = IAM_ACTION.exec(group.example)?.[1];
      return [
        {
          ...base,
          title: `The portal's role is not allowed ${action ?? 'this call'} in IAM`,
          fix: 'The stack grants the write access only when asked. On the machine you deploy from, add "metadataSync": true to infrastructure/cdk/cdk.context.json (it is not in git), then deploy again.',
          command: 'just deploy',
        },
      ];
    }
    if (kind === 'lake-formation') {
      return [
        {
          ...base,
          title: 'Lake Formation has not granted the role these tables',
          fix: 'A data lake admin grants the role DESCRIBE and ALTER on the tables, once per database. No SELECT is needed: the sync never reads a row.',
          command: `just metadata-sync-grant "${[...group.databases].sort().join(',')}"`,
        },
      ];
    }
    if (kind === 'smus-seat') {
      return [
        {
          ...base,
          title: 'The role cannot change these assets in SageMaker Unified Studio',
          fix: 'An asset is changed by a contributor of the project that owns it. Give the role that seat in each owning project, with admin credentials.',
          command:
            'just smus-grant <domain id> "<projects>" <region> QuicksightPortalStack PROJECT_CONTRIBUTOR',
        },
      ];
    }
    return [
      {
        ...base,
        title: 'Something else was refused or failed',
        fix: 'The reason AWS gave is below; the job log on the Jobs section has each one.',
      },
    ];
  });
}
